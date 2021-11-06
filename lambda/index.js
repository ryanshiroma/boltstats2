const AWS = require('aws-sdk');
const OnStar = require('onstarjs');
const ssm = new AWS.SSM({region: 'us-east-1'});



async function  getCredentials() {
    let ssmParameters = {Name:'mychevrolet',WithDecryption:true};
    try{
        let responseFromSSM = await ssm.getParameter(ssmParameters).promise();
        const creds = responseFromSSM.Parameter.Value;   
        return creds;
    } catch(err) {
        console.log(err);
    }
}

async function onStarCall(credsJSON) {
    
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
        requestPollingTimeoutSeconds: 180, // When checkRequestStatus is true, this is when requests while polling are considered timed out
    };


    const onStar = OnStar.create(onStarConfig);
    
    const options = ["ENGINE COOLANT TEMP", "ENGINE RPM", "LAST TRIP FUEL ECONOMY", "EV ESTIMATED CHARGE END", 
                "EV BATTERY LEVEL", "OIL LIFE", "EV PLUG VOLTAGE", "LIFETIME FUEL ECON", "HOTSPOT CONFIG", 
                "LIFETIME FUEL USED", "ODOMETER", "HOTSPOT STATUS", "LIFETIME EV ODOMETER", "EV PLUG STATE", 
                "EV CHARGE STATE", "TIRE PRESSURE", "AMBIENT AIR TEMPERATURE", "LAST TRIP DISTANCE", 
                "INTERM VOLT BATT VOLT", "GET COMMUTE SCHEDULE", "GET CHARGE MODE", "EV SCHEDULED CHARGE START", 
                "FUEL TANK INFO", "HANDS FREE CALLING", "ENERGY EFFICIENCY", "VEHICLE RANGE"];
    
    try {
        let allDiagnostics = await onStar.diagnostics({"diagnosticItem": options});
        return allDiagnostics;
    } catch (err) {
        if (err.getResponse) {
            console.log(JSON.stringify(err.getResponse().data));
        }
    }
  };

async function saveToDDB(raw_response) {

    AWS.config.update({region: 'us-east-1'});
    var ddb = new AWS.DynamoDB.DocumentClient();
    var table = "boltstatsJS";
    response = raw_response.response.data.commandResponse.body.diagnosticResponse;
    console.log(response);
    for (let group = 0; group < response.length; group++) {
        let diagnosticGroup = response[group];
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
            try {
                await ddb.put(ddbItem).promise();
            } catch (error) {
                console.log("Error", error,ddbItem);           
            };
        }
      }
      return 'Success'
  }


exports.handler = async (event) => {

    const creds = await getCredentials();
    console.log('got creds');
    
    const raw_response = await onStarCall(creds);
    console.log('pulled onstar');

    const status = await saveToDDB(raw_response);
    console.log(status);
    console.log('saved to DynamoDB');

    return {
        statusCode: 200,
        body: 'Complete!',
    };
 }
