'use strict';


const AzureClient = require('azure-iot-device').Client;
const AzureConnectionString = require('azure-iot-device').ConnectionString;
const DeviceMessage = require('azure-iot-device').Message;
const MqttProtocol = require('azure-iot-device-mqtt').Mqtt;
const bi = require('az-iot-bi');

const fs = require('fs');
const path = require('path');
const gpio = require('onoff').Gpio;

const MessageSender = require('./messageSender.js');

var messageId = 0;
var client, config, messageSender;
var messageSendStatus = true;


function sendMessage() {
    if (!messageSendStatus) {
        return;
    }

    messageId++;

    messageSender.getMessage(messageId, (content, temperatureAlert) => {
        var message = new DeviceMessage(content.toString('utf-8'));
        message.contentEncoding = 'utf-8';
        message.contentType = 'application/json';
        message.properties.add('temperatureAlert', temperatureAlert ? 'true' : 'false');

        console.log('[Device] Sending message: ' + content);

        client.sendEvent(message, (err) => {
            if (err) {
                console.error('[Device] Failed to send message to Azure IoT Hub due to:\n\t' + err.message);
            } else {
                blinkLed();
                console.log('[Device] Message sent to Azure IoT Hub');
            }

            setTimeout(sendMessage, config.interval);
        });
    });
}

function blinkLed() {
    const led = new gpio(config.LEDPinGPIO, 'out');
    led.writeSync(1);
    setTimeout(function () {
        led.writeSync(0);
    }, 500);
}

function onStart(request, response) {
    console.log('[Device] Trying to invoke method Start(' + request.payload || '' + ')');

    messageSendStatus = true;

    response.send(200, 'Successully start sending message to Azure.', function (err) {
        if (err) {
            console.error('[IoT Hub Client] Failed sending a start method response due to:\n\t' + err.message);
        }
    });
}

function onStop(request, response) {
    console.log('[Device] Trying to invoke method Stop(' + request.payload || '' + ')');

    messageSendStatus = false;

    response.send(200, 'Successully stop sending message to Azure', function (err) {
        if (err) {
            console.error('[IoT Hub Client] Failed sending a stop method response due to:\n\t' + err.message);
        }
    });

}

function receiveMessageCallback(msg) {
    blinkLED();

    var message = msg.getData().toString('utf-8');

    client.complete(msg, () => {
        console.log('Received message:\n\t' + message);
    });
}

function initClient(connectionStringParam, credentialPath) {
    var connectionString = AzureConnectionString.parse(connectionStringParam);
    var deviceId = connectionString.DeviceId;

    // set Mgtt as transport protocol
    console.log('[Device] Using MQTT transport protocol');
    client = AzureClient.fromConnectionString(connectionStringParam, MqttProtocol);

    // Configure the client to use X509 authentication if required by the connection string.
    if (connectionString.x509) {
        // Read X.509 certificate and private key.
        // These files should be in the current folder and use the following naming convention:
        // [device name]-cert.pem and [device name]-key.pem, example: myraspberrypi-cert.pem
        var connectionOptions = {
            cert: fs.readFileSync(path.join(credentialPath, deviceId + '-cert.pem')).toString(),
            key: fs.readFileSync(path.join(credentialPath, deviceId + '-key.pem')).toString()
        };

        client.setOptions(connectionOptions);

        console.log('[Device] Using X.509 client certificate authentication');
    }

    if (connectionString.GatewayHostName && config.iotEdgeRootCertFilePath) {
        var deviceClientOptions = {
            sa: fs.readFileSync(config.iotEdgeRootCertFilePath, 'utf-8'),
        }

        client.setOptions(deviceClientOptions, function (err) {
            if (err) {
                console.error('[Device] error specifying IoT Edge root certificate: ' + err);
            }
        });

        console.log('[Device] Using IoT Edge private root certificate');
    }

    return client;
}

(function (connectionString) {
    try {
        config = require('./config.json');
    } catch (err) {
        console.error('Failed to load file config.json:\n\t' + err.message);
        return;
    }


    messageSender = new MessageSender(config);

    try {
        var firstTimeSetting = false;
        if (!fs.existsSync(path.join(process.env.HOME, '.iot-hub-getting-started/biSettings.json'))) {
            firstTimeSetting = true;
        }

        bi.start();

        var deviceInfo = {device: "RaspberryPi", language: "NodeJS"};

        if (bi.isBIEnabled()) {
            bi.trackEventWithoutInternalProperties('yes', deviceInfo);
            bi.trackEvent('success', deviceInfo);
        } else {
            bi.disableRecordingClientIP();
            bi.trackEventWithoutInternalProperties('no', deviceInfo);
        }

        if (firstTimeSetting) {
            console.log("Telemetry setting will be remembered. If you would like to reset, please delete following file and run the sample again");
            console.log("~/.iot-hub-getting-started/biSettings.json\n");
        }

        bi.flush();
    } catch (e) {

    }

    // read out the connectionString from process environment
    connectionString = connectionString || process.env['AzureIoTHubDeviceConnectionString'];
    client = initClient(connectionString, config);

    client.open((err) => {
        if (err) {
            console.error('[IoT Hub Client] Connect error:\n\t' + err.message);
            return;
        }

        // set C2D and device method callback
        client.onDeviceMethod('start', onStart);
        client.onDeviceMethod('stop', onStop);
        client.on('message', receiveMessageCallback);
        setInterval(() => {
            client.getTwin((err, twin) => {
                if (err) {
                    console.error('[IoT Hub Client] Got twin message error:\n\t' + err.message);
                    return;
                }
                config.interval = twin.properties.desired.interval || config.interval;
            });
        }, config.interval);
        sendMessage();
    });
})(process.argv[2]);
