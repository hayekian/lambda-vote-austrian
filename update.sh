rm data.zip
zip -r data.zip .
aws lambda update-function-code --function-name VoteAustrian --zip-file fileb://data.zip

