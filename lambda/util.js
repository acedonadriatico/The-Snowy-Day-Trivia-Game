const AWS = require('aws-sdk');

const s3SigV4Client = new AWS.S3({
    "signatureVersion": 'v4',
    "region": process.env.S3_PERSISTENCE_REGION
});

function getS3PreSignedUrl(s3ObjectKey) {
    const bucketName = process.env.S3_PERSISTENCE_BUCKET;
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        "Bucket": bucketName,
        "Key": s3ObjectKey,
        "Expires": 60*1 // the Expires is capped for 1 minute
    });
    console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
    return s3PreSignedUrl;
}

function supportsAPL(handler_input) {
    const supported_interfaces = handler_input.requestEnvelope.context.System.device.supportedInterfaces;
    const apl_interface = supported_interfaces['Alexa.Presentation.APL'];
    return apl_interface !== null && apl_interface !== undefined;
}

module.exports = {
    getS3PreSignedUrl,
    supportsAPL
};