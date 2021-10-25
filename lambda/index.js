const AWS = require('aws-sdk');
const OnStar = require('onstarjs');
const ssm = new AWS.SSM({region: 'us-east-1'});



exports.handler = async (event) => {

    const creds = await getCredentials();
    console.log('got creds');
    
    await onStarCall(creds);
    console.log('called onstar');
    
    const response = {
        statusCode: 200,
        body: 'Complete!',
    };
    return response;
 }


const getCredentials = async () => {
    let ssmParameters = {Name:'mychevrolet',WithDecryption:true};
    try{
        let responseFromSSM = await ssm.getParameter(ssmParameters).promise();
        const creds = responseFromSSM.Parameter.Value;   
        return creds;
    } catch(err) {
        console.log(err);
    }
}




const onStarCall = async (credsJSON) => {
    
    const mychevy_credentials = JSON.parse(credsJSON);
    const deviceId = mychevy_credentials.deviceId;
    const vin = mychevy_credentials.vin;
    const username = mychevy_credentials.username;
    const password = mychevy_credentials.password;
    const onStarPin = mychevy_credentials.onStarPin;
    
    const onStarConfig = {
        deviceId: deviceId,
        vin: vin,
        username: username,
        password: password,
        onStarPin: onStarPin,
    
        // Optional
        checkRequestStatus: true, // When false, requests are complete when 'In Progress' (Much faster).
        requestPollingIntervalSeconds: 20, // When checkRequestStatus is true, this is how often status check requests will be made
        requestPollingTimeoutSeconds: 120, // When checkRequestStatus is true, this is when requests while polling are considered timed out
    };

    
    const onStar = OnStar.create(onStarConfig);
    
    AWS.config.update({region: 'us-east-1'});
    var ddb = new AWS.DynamoDB.DocumentClient();
    var table = "boltstatsJS";
    
    console.log('created config');
    
    const options = ["ENGINE COOLANT TEMP", "ENGINE RPM", "LAST TRIP FUEL ECONOMY", "EV ESTIMATED CHARGE END", 
                "EV BATTERY LEVEL", "OIL LIFE", "EV PLUG VOLTAGE", "LIFETIME FUEL ECON", "HOTSPOT CONFIG", 
                "LIFETIME FUEL USED", "ODOMETER", "HOTSPOT STATUS", "LIFETIME EV ODOMETER", "EV PLUG STATE", 
                "EV CHARGE STATE", "TIRE PRESSURE", "AMBIENT AIR TEMPERATURE", "LAST TRIP DISTANCE", 
                "INTERM VOLT BATT VOLT", "GET COMMUTE SCHEDULE", "GET CHARGE MODE", "EV SCHEDULED CHARGE START", 
                "FUEL TANK INFO", "HANDS FREE CALLING", "ENERGY EFFICIENCY", "VEHICLE RANGE"];
    
                
    const allDiagnostics = await onStar.diagnostics({"diagnosticItem": options}).catch(e => { console.log(e); });

    console.log(allDiagnostics.response.data.commandResponse.body.diagnosticResponse);
    console.log('finished pull')
    for (let group = 0; group < allDiagnostics.response.data.commandResponse.body.diagnosticResponse.length; group++) {
        let diagnosticGroup = allDiagnostics.response.data.commandResponse.body.diagnosticResponse[group];
        let groupName = diagnosticGroup.name;
        let groupElements = diagnosticGroup.diagnosticElement;
        for (let element = 0; element < groupElements.length; element++) {
            let elementObj = groupElements[element]
            console.log(groupElements[element]);
            let ddbItem = {TableName: table,
                            Item: {time: Date.now(),
                                diagnosticGroup: groupName,
                                diagnosticElement: elementObj.hasOwnProperty('name') ? elementObj.name : 'NA',
                                ElementStatus: elementObj.hasOwnProperty('status') ? elementObj.status : 'NA',
                                ElementMessage: elementObj.hasOwnProperty('message') ? elementObj.message : 'NA',
                                ElementValue: elementObj.hasOwnProperty('value') ? elementObj.value : 'NA',
                                ElementUnit: elementObj.hasOwnProperty('unit') ? elementObj.unit : 'NA'
                                }
                            };
            ddb.put(ddbItem, function(err, ddbItem) {
                if (err) {
                console.log("Error", ddbItem);
                } else {
                console.log("Success", ddbItem);
                }
            });
        }
      }
  };
