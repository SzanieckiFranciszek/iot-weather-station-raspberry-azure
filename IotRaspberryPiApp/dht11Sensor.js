'use strict';

const Dht11Sensor = require('node-dht-sensor')

const SensorType = 11;

const DefaultOptions = {
    pin: 4, //GPIO pin number
};

function Sensor(options) {
    options = Object.assign(DefaultOptions, options || {});
    this.dht11 = {
        initialize: () => {
            return Dht11Sensor.initialize(SensorType, options.pin);
        }, read: () => {
            return Dht11Sensor.read(SensorType, options.pin);
        },
    };
}

Sensor.prototype.init = function (callback) {
    this.dht11.initialize();
    callback(); // DHT11 initialization is synchronous, so no need for promises
}

Sensor.prototype.read = function (callback) {
    const sensorReadout = this.dht11.read();
    if (sensorReadout.isValid) {
        const data = {
            temperature: sensorReadout.temperature.toFixed(2), humidity: sensorReadout.humidity.toFixed(2),
        };
        callback(null, data);
    } else {
        callback(new Error('[Device] Failed to read data from DHT11 sensor'));
    }
}

module.exports = Sensor;
