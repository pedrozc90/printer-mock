export enum PrinterStatus {
    STANDBY = 0,                                    // waiting for receiving data
    WAITING = 1,                                    // waiting for dispensing
    ANALYSING = 2,
    PRITING = 3,
    OFFLINE = 4,
    ERROR = 5
}

export enum BufferStatus {
    BUFFER_AVAILABLE = 0,
    BUFFER_NEAR_FULL = 1,
    BUFFER_FULL = 2
}

export enum RibbonStatus {
    RIBBON_PRESENT = 0,
    RIBBON_NEAR_END = 1,
    NO_RIBBON = 2,
    DIRECT_THERMAL_MODEL = 3
}

export enum MediaStatus {
    MEDIA_PRESENT = 0,                              // including during startup
    NO_MEDIA = 2
}

export enum ErrorNumber {
    ONLINE = 0,                                     // Not an error. Return is performed
    OFFLINE = 1,                                    // Not an error. Return is performed
    MACHINE_ERROR = 2,
    MEMORY_ERROR = 3,
    PROGRAM_ERROR = 4,
    FLASH_ROM_ERRO = 5,                             // setting information error (FLASH-ROM error)
    EE_PROM_ERROR = 6,                              // setting information error (EE-PROM error)
    DOWNLOAD_ERROR = 7,
    PARITY_ERROR = 8,
    OVER_RUN = 9,
    FRAMING_ERROR = 10,
    LAN_TIMEOUT_ERROR = 11,
    BUFFER_OVER = 12,
    HEAD_OPEN = 13,
    PAPER_END = 14,
    RIBBON_END = 15,
    MEDIA_ERROR = 16,
    SENSOR_ERROR = 17,
    PRINTHEAD_ERROR = 18,
    COVER_OPEN_ERROR = 19,
    MEMORY_CARD_TYPE_ERROR = 20,
    MEMORY_CARD_READ_WRITE_ERROR = 21,
    MEMORY_CARD_FULL_ERROR = 22,
    MEMORY_CARD_NO_BATTERY_ERROR = 23,
    RIBBON_SAVER_ERROR = 24,
    CUTTER_ERROR = 25,
    CUTTER_SENSOR_ERROR = 26,
    STACKER_FULL_ERROR = 27,
    COMMAND_ERROR = 28,
    SENSOR_ERROR_AT_POWER_ON = 29,
    RFID_TAG_ERROR = 30,
    INTERFACE_CARD_ERROR = 31,
    REWINDER_ERROR = 32,
    OTHER_ERROR = 33,
    RFID_CONTROL_ERROR = 34,
    HEAD_DENSITY_ERROR = 35,
    KANJI_DATA_ERROR = 36,
    CALENDAR_ERROR = 37,
    ITEM_NO_ERROR = 38,
    BCC_ERROR = 39,
    CUTTER_COVER_OPEN_ERROR = 40,
    RIBBON_REWIND_NON_LOCK_ERROR = 41,
    COMMUNICATION_TIMEOUT_ERROR = 42,
    LID_LATCH_OPEN_ERROR = 43,
    NO_MEDIA_ERROR_AT_POWER_ON = 44,
    SD_CARD_ACCESS_ERROR = 45,
    SD_CARD_FULL_ERROR = 46,
    HEAD_LIFT_ERROR = 47,
    HEAD_OVERHEAT_ERROR = 48,
    SNTP_TIME_CORRECTION_ERROR = 49,
    CRC_ERROR = 50,
    CUTTER_MOTOR_ERROR = 51,
    WLAN_MODULE_ERROR = 52,
    SCANNER_READING_ERROR = 53,
    SCANNER_CHECKING_ERROR = 54,
    SCANNER_CONNECTION_ERROR = 55,
    BLUETOOTHMODULEERROR = 56,
    EAP_FAILED = 57,                                // EAP authentication error(EAP failed)
    EAP_TIME_OUT = 58,                              // EAP authentication error(Time out)
    BATTERY_ERROR = 59,
    LOW_BATTERY_ERROR = 60,
    LOW_BATTERY_CHARGING_ERROR = 61,                // low battery error (charging)
    BATTERY_NOT_INSTALLED_ERROR = 62,
    BATTERY_TEMPERATURE_ERROR = 63,
    BATTERY_DETERIORATION_ERROR = 64,
    MOTOR_TEMPERATURE_ERROR = 65,
    INSIDE_CHASSIS_TEMPERATURE_ERROR = 66,
    JAM_ERROR = 67,
    SIPL_FIELD_FULL_ERROR = 68,
    POWER_OFF_ERROR_WHEN_CHARGING = 69,
    WLAN_MODULE_ERROR_2 = 70,
    OPTION_MISMATCH_ERROR = 71,
    BATTERY_DETERIORATION_ERROR_NOTICE = 72,
    BATTERY_DETERIORATION_ERROR_WARNING = 73,
    POWER_OFF_ERROR = 74,
    NONRFID_WARNING_ERROR = 75,
    BARCODE_READER_CONNECTION_ERROR = 76,
    BARCODE_READING_ERROR = 77,
    BARCODE_VERIFICATION_ERROR = 78,
    BARCODE_READING_START_POSITION_ERROR = 79,      // barcode reading error (verification start position abnormality)
}

export enum BatteryStatus {
    NORMAL = 0,
    BATTERY_NEAR_END = 1,
    BATTERY_ERROR = 2
}
