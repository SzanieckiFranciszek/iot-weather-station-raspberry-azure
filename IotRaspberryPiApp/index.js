'use strict';


const azureClient = require('azure-iot-device').Client;
const azureConnectionString = require('azure-iot-device').ConnectionString;
const deviceMessage = require('azure-iot-device').Message;
const mqttProtocol = require('azure-iot-device-mqtt').Mqtt;
const amqpProtocol = require('azure-iot-device-amqp').Amqp;
const AzureBi = require('az-iot-bi');

const Fs = require('fs');
const Path = require('path');
const Gpio = require('onoff').Gpio;

const MessageSender = require('./messageSender.js');

var messageId = 0;
var client, config, messageSender;
var messageSendStatus = true;


function sendMessage() {
    if (!messageSendStatus) { return; }

    messageId++;

    messageSender.getMessage(messageId, (content, temperatureAlert) => {
        var message = new Message(content.toString('utf-8'));
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
    const led = new Gpio(config.LEDPinGPIO, 'out');
    led.writeSync(1);
    setTimeout(function () {
        led.writeSync(0);
    }, 500);
}
