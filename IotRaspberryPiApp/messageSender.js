'use strict';

const Dht11Sensor = require('./dht11Sensor.js');
const SimulatedSensor = require('./simulatedSensor.js');


function MessageSender(option) {
    option = Object.assign({
        deviceId: '[Unknown device] node',
        temperatureAlert: 30
    }, option);
    this.sensor = option.simulatedData ? new SimulatedSensor() : new Dht11Sensor(option.i2cOption);
    this.deviceId = option.deviceId;
    this.temperatureAlert = option.temperatureAlert
    this.sensor.init(() => {
        this.inited = true;
    });
}

MessageSender.prototype.getMessage = function (messageId, cb) {
    if (!this.inited) {
        return;
    }
    this.sensor.read((err, data) => {
        if (err) {
            console.log('[Sensor] Read data failed due to:\n\t' + err.message);
            return;
        }

        cb(JSON.stringify({
            messageId: messageId,
            deviceId: this.deviceId,
            temperature: data.temperature,
            humidity: data.humidity
        }), data.temperature > this.temperatureAlert);
    });
}

module.exports = MessageSender;
