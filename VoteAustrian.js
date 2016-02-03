var request = require('request');
var async = require('async');
var AWS = require("aws-sdk");

AWS.config.update({
    region: "us-east-1",
    accessKeyId: 'the key', 
    secretAccessKey: 'the id' 
});

var paramsGetRaces = {
    TableName: "races"
};

var paramsUsers = {
    TableName: "users"
};



process.on('uncaughtException', function (err) {
    console.error(err);
    console.log("Node NOT Exiting...");
});

console.log('Loading function');
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();


exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event, null, 4));
    var request_data = {};
    request_data.event = event;
    request_data.context = context;
    Log(request_data);
    var cmd = event;
    cmd.data = JSON.parse(cmd.data);

    var f_done = function (err, d) {
	    var Result = {};
	    if (err) {
		Result.status = 1;
		Result.errorMessage = JSON.stringify(err);
	    }
	    else {
		Result.status = 0;
	    }
	    Result.data = d;
	    context.succeed(Result);  
    };

    switch (cmd.cmd) {
    
  	    case "GetData":
                GetRaces(cmd, f_done);
                break;
            case "VerifyLogin":
                VerifyLogin(cmd, f_done);
                break;
            case "UpdateUser":
                UpdateUser(cmd, f_done);
   		break;
            case "DeleteUser":
                DeleteUser(cmd, f_done);
	}     
    
};


function VerifyLogin(cmd, next){
    VerifyUserToken(cmd, function (err, res) { 
        if (err) {
            next("Authentication failed", null);
        }
        else
            UserLoggedIn(cmd, next);
          
    });
}


function VerifyUserToken(cmd, next) { 

    var verifyLink = "";
    if (cmd.data.LoginType == "FB")
        verifyLink = 'https://graph.facebook.com/me/?access_token=' + cmd.data.Token;
    else
        verifyLink = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' + cmd.data.Token;
    
    request(verifyLink, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            next(null, null);
        }
        else next(error, null);
    });

}

function  UserLoggedIn(cmd, next) { 
    var params = {
        TableName : "users",
        KeyConditionExpression: "#userid = :id",
        ExpressionAttributeNames: {
            "#userid": "user_id"
        },
        ExpressionAttributeValues: {
            ":id": cmd.data.UserID
        }
    };  
    docClient.query(params, function (err, data) {    
       
        if (data.Items.length > 0) {
            next(null, data.Items[0]);      
        }
        else {
            CreateNewUser(cmd, next);
        }       
    });
}

function Log(obj){

  var date = new Date();
    var params = {
        TableName: 'sitelogs',
        Item: {
            "site": "VoteAustrian",
            "date": date.toUTCString() ,
            "info": obj
        }
    };
    docClient.put(params, function (err, data) {

	if (err)
		console.log( JSON.stringify(err)  );    

    });



}

function CreateNewUser(cmd, next) { 

    var date = new Date();
    var params = {
        TableName: 'users',
        Item: {
            "user_id": cmd.data.UserID,
            "date_joined": date.toUTCString(),
            "Name": cmd.data.Name,
            "race_id": "none",
            "image": cmd.data.imageURL,
            "info": {}
        }
    };  
    console.log("Adding a new item...");
    docClient.put(params, function (err, data) {
        next(err, params.Item);      
    });


}

function UpdateUser(cmd, next) { 

    VerifyUserToken(cmd, function (err) {
        
        if (err) {
            next(err);
            return;
        }     
        var date = new Date();
        var params = {
            TableName: 'users',
            Key: {
                "user_id": cmd.data.UserInfo.user_id,
                "date_joined" : cmd.data.UserInfo.date_joined
            },
            UpdateExpression: "set info.blurb = :b, info.website=:w, race_id = :r, info.interest = :l",
            ExpressionAttributeValues: {
                ":b": cmd.data.UserInfo.info.blurb,
                ":w": cmd.data.UserInfo.info.website,
                ":r": cmd.data.UserInfo.race_id,
                ":l": cmd.data.UserInfo.info.interest
            },
            ReturnValues: "UPDATED_NEW"
        };
        console.log("updating item...");
        docClient.update(params, function (err, data) {
            if (err) {
                console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                next(err, data);
            } else {
                console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                next(null, data);
            }
        });
        
    });

}


function GetRaces(cmd, next) { 


    var my_res = {};
    async.parallel({
        one: function (callback) {
            
            docClient.scan(paramsGetRaces, function (err, data) {
                if (err) {
                    callback(err);
                }
                else {
                    my_res.Incumbents = data.Items;
                    callback(null, "ok");
                }
            });
        },
        two: function (callback) {
            
            docClient.scan(paramsUsers, function (err, data) {
                if (err) {
                    callback(err);
                }
                else {
                    my_res.Users = data.Items;
                    callback(null, "ok");
                }
            });
        }
    },
            function (err, results) {
        next(err, my_res);
    });         




}



function DeleteUser(cmd, next) {
    
    VerifyUserToken(cmd, function (err) {
        
        if (err) {
            next(err);
            return;
        }
        
        
        var params = {
        "TableName": "users",
            "Key": {
                "user_id": {
                    "S": cmd.data.user_id
                },
                "date_joined": {
                    "S": cmd.data.date_joined
                }
            }
        };
 
        
        dynamodb.deleteItem(params, function (err, data) {
            if (err) {
                next(err, data);
            } else {
                next(null, data);
            }
        });
      
        
    });

}


