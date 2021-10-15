# boltstats2
 *more detailed readme to come*
 
 A simple Lambda function to periodically pull diagnostics data from onStar and save it to DynamoDB using the package OnStarJS
 
 https://github.com/samrum/OnStarJS
 
## Instructions

1. create a `Lambda` function using the the function.zip file
2. add a parameter to `Parameter Store` with the name `mychevrolet`(fillin the blanks):
```
{"username": "",
"password": "",
"onStarPin": "",
"deviceId": "",
"vin": ""}
```
*use https://www.uuidgenerator.net/version4 to generate a random deviceId*

3. create a `CloudWatch Events` trigger with schedule expression: `cron(0/20 * * * ? *)`

4. create a `DynamoDB` table called boltstatsJS using 
   - Partition key: 'diagnosticElement' (String)
   - Sort key: 'time' (Number)
