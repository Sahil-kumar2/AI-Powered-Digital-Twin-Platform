import {
    Thermometer, Droplets, Zap, Cpu, Settings, Radio, Wifi, Bluetooth,
    Fan, ToggleRight, Battery, Power, HardDrive, Database, Activity,
    Gauge, Wind, Eye, Mic, Sun,
} from "lucide-react";

// ─── Signal Types ───────────────────────────────
export type SignalType =
    | "temperature" | "humidity" | "voltage" | "current" | "pressure"
    | "digital" | "analog" | "pwm" | "serial" | "spi" | "i2c"
    | "rf_wireless" | "wifi_data" | "bluetooth_data"
    | "power_dc" | "power_ac" | "control_signal" | "data_stream";

// ─── Port Definition ────────────────────────────
export interface PortDef {
    id: string;
    label: string;
    signalType: SignalType;
    direction: "input" | "output";
}

// ─── Component Parameter Schema ─────────────────
export interface ParamDef {
    key: string;
    label: string;
    type: "number" | "select" | "text" | "range";
    defaultValue: any;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: { label: string; value: any }[];
}

// ─── Component Template ─────────────────────────
export interface ComponentTemplate {
    type: string;
    name: string;
    description: string;
    category: ComponentCategory;
    icon: any; // Lucide icon component
    color: string;
    ports: PortDef[];
    params: ParamDef[];
    power?: { voltage: number; current: number };
}

export type ComponentCategory =
    | "Sensors"
    | "Controllers"
    | "Actuators"
    | "Power Systems"
    | "Communication"
    | "Processing";

// ─── Signal Compatibility Matrix ────────────────
export const SIGNAL_COMPAT: Record<SignalType, SignalType[]> = {
    // Sensor signals can travel over any data bus (analog, serial, SPI, I2C)
    temperature: ["analog", "serial", "spi", "i2c", "data_stream"],
    humidity: ["analog", "serial", "spi", "i2c", "data_stream"],
    voltage: ["analog", "serial", "data_stream", "power_dc", "power_ac"],
    current: ["analog", "serial", "data_stream"],
    pressure: ["analog", "serial", "spi", "i2c", "data_stream"],
    digital: ["digital", "control_signal", "analog"],
    analog: ["analog", "serial", "spi", "i2c", "data_stream", "temperature", "humidity", "voltage", "current", "pressure"],
    pwm: ["pwm", "control_signal", "analog", "digital"],
    serial: ["serial", "data_stream", "analog", "spi", "i2c"],
    spi: ["spi", "serial", "data_stream", "i2c"],
    i2c: ["i2c", "serial", "data_stream", "spi"],
    rf_wireless: ["rf_wireless", "data_stream", "wifi_data", "bluetooth_data"],
    wifi_data: ["wifi_data", "data_stream", "rf_wireless"],
    bluetooth_data: ["bluetooth_data", "data_stream", "rf_wireless"],
    power_dc: ["power_dc", "voltage", "power_ac"],
    power_ac: ["power_ac", "voltage", "power_dc"],
    control_signal: ["control_signal", "digital", "pwm", "analog"],
    data_stream: ["data_stream", "serial", "spi", "i2c", "analog", "wifi_data", "bluetooth_data"],
};

export function areSignalsCompatible(output: SignalType, input: SignalType): boolean {
    if (output === input) return true;
    return SIGNAL_COMPAT[output]?.includes(input) || false;
}

// ─── Component Library ──────────────────────────
export const COMPONENT_LIBRARY: ComponentTemplate[] = [
    // ── Sensors ──
    {
        type: "TemperatureSensor", name: "Temperature Sensor", category: "Sensors",
        description: "NTC/RTD probe for thermal monitoring",
        icon: Thermometer, color: "#f97316",
        ports: [
            { id: "temp_out", label: "Temp Data", signalType: "temperature", direction: "output" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
        ],
        params: [
            { key: "samplingRate", label: "Sampling Rate", type: "select", defaultValue: 1000, unit: "ms", options: [{ label: "100ms", value: 100 }, { label: "500ms", value: 500 }, { label: "1s", value: 1000 }, { label: "5s", value: 5000 }] },
            { key: "noiseLevel", label: "Signal Noise", type: "range", defaultValue: 0.2, min: 0, max: 1, step: 0.05 },
            { key: "failureProbability", label: "Failure Prob.", type: "range", defaultValue: 0.01, min: 0, max: 0.5, step: 0.01 },
            { key: "rangeMin", label: "Range Min (°C)", type: "number", defaultValue: -40, min: -273, max: 500 },
            { key: "rangeMax", label: "Range Max (°C)", type: "number", defaultValue: 125, min: -273, max: 500 },
        ],
        power: { voltage: 3.3, current: 0.005 },
    },
    {
        type: "HumiditySensor", name: "Humidity Sensor", category: "Sensors",
        description: "Capacitive humidity probe",
        icon: Droplets, color: "#3b82f6",
        ports: [
            { id: "hum_out", label: "Humidity Data", signalType: "humidity", direction: "output" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
        ],
        params: [
            { key: "samplingRate", label: "Sampling Rate", type: "select", defaultValue: 1000, unit: "ms", options: [{ label: "500ms", value: 500 }, { label: "1s", value: 1000 }, { label: "5s", value: 5000 }] },
            { key: "noiseLevel", label: "Signal Noise", type: "range", defaultValue: 0.15, min: 0, max: 1, step: 0.05 },
            { key: "failureProbability", label: "Failure Prob.", type: "range", defaultValue: 0.01, min: 0, max: 0.5, step: 0.01 },
        ],
        power: { voltage: 3.3, current: 0.003 },
    },
    {
        type: "VoltageSensor", name: "Voltage Sensor", category: "Sensors",
        description: "Inline voltage divider / ADC probe",
        icon: Gauge, color: "#eab308",
        ports: [
            { id: "volt_out", label: "Voltage Data", signalType: "voltage", direction: "output" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
        ],
        params: [
            { key: "samplingRate", label: "Sampling Rate", type: "select", defaultValue: 500, unit: "ms", options: [{ label: "100ms", value: 100 }, { label: "500ms", value: 500 }, { label: "1s", value: 1000 }] },
            { key: "maxVoltage", label: "Max Range (V)", type: "number", defaultValue: 25, min: 0, max: 1000 },
            { key: "noiseLevel", label: "Signal Noise", type: "range", defaultValue: 0.1, min: 0, max: 1, step: 0.05 },
        ],
        power: { voltage: 5, current: 0.002 },
    },
    {
        type: "PressureSensor", name: "Pressure Sensor", category: "Sensors",
        description: "Piezoresistive pressure transducer",
        icon: Wind, color: "#a855f7",
        ports: [
            { id: "pres_out", label: "Pressure Data", signalType: "pressure", direction: "output" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
        ],
        params: [
            { key: "samplingRate", label: "Sampling Rate", type: "select", defaultValue: 1000, unit: "ms", options: [{ label: "500ms", value: 500 }, { label: "1s", value: 1000 }] },
            { key: "noiseLevel", label: "Signal Noise", type: "range", defaultValue: 0.15, min: 0, max: 1, step: 0.05 },
        ],
        power: { voltage: 5, current: 0.01 },
    },

    // ── Controllers ──
    {
        type: "Microcontroller", name: "Microcontroller", category: "Controllers",
        description: "ARM Cortex-M4 MCU (STM32 class)",
        icon: Cpu, color: "#818cf8",
        ports: [
            { id: "adc_in", label: "ADC Input", signalType: "analog", direction: "input" },
            { id: "serial_in", label: "Serial RX", signalType: "serial", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "gpio_out", label: "GPIO Out", signalType: "digital", direction: "output" },
            { id: "pwm_out", label: "PWM Out", signalType: "pwm", direction: "output" },
            { id: "serial_out", label: "Serial TX", signalType: "serial", direction: "output" },
            { id: "data_out", label: "Data Stream", signalType: "data_stream", direction: "output" },
        ],
        params: [
            { key: "clockSpeed", label: "Clock Speed", type: "select", defaultValue: 72, unit: "MHz", options: [{ label: "16 MHz", value: 16 }, { label: "48 MHz", value: 48 }, { label: "72 MHz", value: 72 }, { label: "168 MHz", value: 168 }] },
            { key: "firmware", label: "Firmware", type: "text", defaultValue: "default_controller.bin" },
            { key: "failureProbability", label: "Failure Prob.", type: "range", defaultValue: 0.005, min: 0, max: 0.5, step: 0.005 },
        ],
        power: { voltage: 3.3, current: 0.050 },
    },
    {
        type: "PLCController", name: "PLC Controller", category: "Controllers",
        description: "Industrial programmable logic controller",
        icon: Settings, color: "#64748b",
        ports: [
            { id: "analog_in", label: "Analog In", signalType: "analog", direction: "input" },
            { id: "digital_in", label: "Digital In", signalType: "digital", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "control_out", label: "Control Out", signalType: "control_signal", direction: "output" },
            { id: "data_out", label: "Data Out", signalType: "data_stream", direction: "output" },
        ],
        params: [
            { key: "scanRate", label: "Scan Rate", type: "select", defaultValue: 10, unit: "ms", options: [{ label: "1ms", value: 1 }, { label: "5ms", value: 5 }, { label: "10ms", value: 10 }] },
        ],
        power: { voltage: 24, current: 0.5 },
    },

    // ── Actuators ──
    {
        type: "MotorPump", name: "Motor / Pump", category: "Actuators",
        description: "DC motor or centrifugal pump",
        icon: Fan, color: "#10b981",
        ports: [
            { id: "ctrl_in", label: "Control In", signalType: "control_signal", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "status_out", label: "Status", signalType: "data_stream", direction: "output" },
        ],
        params: [
            { key: "maxRPM", label: "Max RPM", type: "number", defaultValue: 3000, min: 0, max: 20000 },
            { key: "failureProbability", label: "Failure Prob.", type: "range", defaultValue: 0.02, min: 0, max: 0.5, step: 0.01 },
        ],
        power: { voltage: 12, current: 2.0 },
    },
    {
        type: "Relay", name: "Relay Switch", category: "Actuators",
        description: "Electromagnetic relay (SPDT)",
        icon: ToggleRight, color: "#22d3ee",
        ports: [
            { id: "ctrl_in", label: "Coil Drive", signalType: "digital", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "switch_out", label: "Switched Out", signalType: "power_dc", direction: "output" },
        ],
        params: [
            { key: "coilVoltage", label: "Coil Voltage", type: "select", defaultValue: 5, unit: "V", options: [{ label: "3.3V", value: 3.3 }, { label: "5V", value: 5 }, { label: "12V", value: 12 }] },
            { key: "maxCurrent", label: "Max Current", type: "number", defaultValue: 10, unit: "A", min: 0, max: 30 },
        ],
        power: { voltage: 5, current: 0.07 },
    },

    // ── Power Systems ──
    {
        type: "PowerSupply", name: "Power Supply", category: "Power Systems",
        description: "Regulated DC power supply (bench or wall-wart)",
        icon: Power, color: "#f59e0b",
        ports: [
            { id: "pwr_out", label: "DC Output", signalType: "power_dc", direction: "output" },
        ],
        params: [
            { key: "outputVoltage", label: "Output Voltage", type: "select", defaultValue: 5, unit: "V", options: [{ label: "3.3V", value: 3.3 }, { label: "5V", value: 5 }, { label: "12V", value: 12 }, { label: "24V", value: 24 }] },
            { key: "maxCurrent", label: "Max Current", type: "number", defaultValue: 3, unit: "A", min: 0.1, max: 30, step: 0.1 },
            { key: "ripple", label: "Voltage Ripple %", type: "range", defaultValue: 0.02, min: 0, max: 0.1, step: 0.005 },
        ],
    },
    {
        type: "Battery", name: "Battery Pack", category: "Power Systems",
        description: "Li-ion / LiFePO4 battery pack",
        icon: Battery, color: "#84cc16",
        ports: [
            { id: "pwr_out", label: "DC Output", signalType: "power_dc", direction: "output" },
            { id: "status_out", label: "BMS Data", signalType: "data_stream", direction: "output" },
        ],
        params: [
            { key: "nominalVoltage", label: "Nominal Voltage", type: "select", defaultValue: 3.7, unit: "V", options: [{ label: "3.7V", value: 3.7 }, { label: "7.4V", value: 7.4 }, { label: "11.1V", value: 11.1 }] },
            { key: "capacity", label: "Capacity", type: "number", defaultValue: 5000, unit: "mAh", min: 100, max: 100000 },
            { key: "initialCharge", label: "Initial Charge %", type: "range", defaultValue: 1, min: 0, max: 1, step: 0.05 },
        ],
    },

    // ── Communication ──
    {
        type: "WiFiModule", name: "WiFi Module", category: "Communication",
        description: "ESP32 / ESP8266 class WiFi transceiver",
        icon: Wifi, color: "#06b6d4",
        ports: [
            { id: "data_in", label: "Data In", signalType: "data_stream", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "wifi_out", label: "WiFi TX", signalType: "wifi_data", direction: "output" },
        ],
        params: [
            { key: "protocol", label: "Protocol", type: "select", defaultValue: "mqtt", options: [{ label: "MQTT", value: "mqtt" }, { label: "HTTP", value: "http" }, { label: "WebSocket", value: "ws" }] },
            { key: "latencyMs", label: "Avg Latency", type: "number", defaultValue: 50, unit: "ms", min: 1, max: 1000 },
        ],
        power: { voltage: 3.3, current: 0.170 },
    },
    {
        type: "BluetoothModule", name: "Bluetooth Module", category: "Communication",
        description: "BLE 5.0 transceiver",
        icon: Bluetooth, color: "#3b82f6",
        ports: [
            { id: "data_in", label: "Data In", signalType: "data_stream", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "bt_out", label: "BT TX", signalType: "bluetooth_data", direction: "output" },
        ],
        params: [
            { key: "profile", label: "BLE Profile", type: "select", defaultValue: "gatt", options: [{ label: "GATT", value: "gatt" }, { label: "SPP", value: "spp" }] },
        ],
        power: { voltage: 3.3, current: 0.012 },
    },

    // ── Processing ──
    {
        type: "EdgeProcessor", name: "Edge Processor", category: "Processing",
        description: "Edge compute unit (Jetson / Pi class)",
        icon: HardDrive, color: "#a78bfa",
        ports: [
            { id: "data_in", label: "Data In", signalType: "data_stream", direction: "input" },
            { id: "wifi_in", label: "Cloud In", signalType: "wifi_data", direction: "input" },
            { id: "pwr_in", label: "Power In", signalType: "power_dc", direction: "input" },
            { id: "data_out", label: "Processed Out", signalType: "data_stream", direction: "output" },
            { id: "control_out", label: "Control Out", signalType: "control_signal", direction: "output" },
        ],
        params: [
            { key: "cores", label: "CPU Cores", type: "select", defaultValue: 4, options: [{ label: "2", value: 2 }, { label: "4", value: 4 }, { label: "8", value: 8 }] },
            { key: "mlModel", label: "ML Model", type: "text", defaultValue: "anomaly_detector_v2" },
        ],
        power: { voltage: 5, current: 3.0 },
    },
];

// ─── Category Grouping ──────────────────────────
export const CATEGORIES: ComponentCategory[] = [
    "Sensors", "Controllers", "Actuators", "Power Systems", "Communication", "Processing",
];

export const CATEGORY_COLORS: Record<ComponentCategory, string> = {
    "Sensors": "#f97316",
    "Controllers": "#818cf8",
    "Actuators": "#10b981",
    "Power Systems": "#f59e0b",
    "Communication": "#06b6d4",
    "Processing": "#a78bfa",
};

export function getTemplate(type: string): ComponentTemplate | undefined {
    return COMPONENT_LIBRARY.find((c) => c.type === type);
}

export function getTemplatesByCategory(category: ComponentCategory): ComponentTemplate[] {
    return COMPONENT_LIBRARY.filter((c) => c.category === category);
}
