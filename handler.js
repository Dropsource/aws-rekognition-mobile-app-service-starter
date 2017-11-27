'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const uuid = require('uuid');

const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.saveImage = (event, context, callback) => {
    const jsonBody = JSON.parse(event.body);
    let imageID = `${Date.now()}-${jsonBody.userName}/${jsonBody.albumName}-${uuid.v1()}`;
    let objectKey = `Incoming/${imageID}`;

    let buf = new Buffer(jsonBody.imageData.replace(/^data:image\/\w+;base64,/, ""), 'base64');

    s3.putObject({
        Bucket: process.env.BUCKET,
        Key: objectKey,
        Body: buf,
        ContentType: 'image/jpeg',
        Metadata: {
            'albumid': jsonBody.albumName,
            'userid': jsonBody.userName
        }
    }, (err, data) => {
            if(err){
                console.error(err);
                callback(new Error('Couldn\'t upload the image.'));
            } else {
                console.log(`Successfully uploaded image to S3 with imageID: ${imageID}`);
                const response = {
                    statusCode: 200,
                    body: JSON.stringify({ "imageID": imageID})
                };

                callback(null, response);
            }
      })
};

module.exports.getImageTags = (event, context, callback) => {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
            imageID: event.queryStringParameters.imageID
        }
    };
    const notFoundResponse = {
        statusCode: 404,
        body: JSON.stringify()
    };
    console.log(`Attempting to retrieve tags for imageID: ${event.queryStringParameters.imageID}`);
    dynamoDb.get(params, (error, result) => {
        if (error) {
            console.error(error);
            callback(new Error(`Error fetching the tags for imageID ${event.queryStringParameters.imageID} from table ${process.env.DYNAMODB_TABLE}`));
        } else if(!result.Item) {
            console.log(`Could not find tags for imageID: ${event.queryStringParameters.imageID} in table.`);
            callback(null, notFoundResponse);
        } else {
            const imageTags = result.Item.tags;
            let isHotDog = false;
            let imageTagsString = "Not sure what this is, probably not a hotdog.";

            if(imageTags && imageTags[0]) {
                imageTagsString = imageTags.join(', ');
                if(imageTags.includes('Hot Dog')){
                    isHotDog = true;
                }
            } else {
                callback(null, notFoundResponse);
            }

            console.log(`Successfully fetched image tags: ${imageTagsString}`);

            const response = {
                statusCode: 200,
                body: JSON.stringify({
                    isHotDog: isHotDog,
                    imageTags: imageTagsString
                })
            };

            callback(null, response);
        }
    });
};

//TODO: query dynamo table for imageId, analyse metadata and check for 'hot dog', return true if found, false if not found