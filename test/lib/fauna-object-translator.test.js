const {
  FaunaObjectTranslator,
} = require("../../src/lib/fauna-object-translator");
const { expect } = require("expect");
const faunadb = require("faunadb");
const q = faunadb.query;

describe("FaunaObjectTranslator", () => {
  describe("field name handling", () => {
    const translator = new FaunaObjectTranslator(["my_number::dog::number"]);
    it("can handle '::' in field names", () => {
      expect(
        translator.getRecord({ a: "234", "my_number::dog": "12" })
      ).toEqual({
        a: "234",
        "my_number::dog": 12,
      });
    });

    it("removes white space from field names", () => {
      expect(translator.getRecord({ " a ": "234", " b ": 12 })).toEqual({
        a: "234",
        b: 12,
      });
    });

    it("can handle unused type translations", () => {
      const translator = new FaunaObjectTranslator([
        "f::number",
        "e::dateString",
      ]);
      expect(translator.getRecord({ " a ": "234", " b ": "12" })).toEqual({
        a: "234",
        b: "12",
      });
    });

    it("rejects invalid translations with an error", () => {
      expect(() => new FaunaObjectTranslator(["dog::frog"])).toThrow(
        "The following columns have an invalid type translation specified: dog"
      );
    });

    it("can build a translator with no translations", () => {
      const noTranslations = new FaunaObjectTranslator([]);
      expect(noTranslations.getRecord({ " a ": "234", " b ": 12 })).toEqual({
        a: "234",
        b: 12,
      });
    });
  });

  describe("number translation", () => {
    const translator = new FaunaObjectTranslator(["my_number::number"]);
    it("should return null, undefined and numbers as is", () => {
      expect(translator.getRecord({ a: "234", my_number: 12 })).toEqual({
        a: "234",
        my_number: 12,
      });
      expect(translator.getRecord({ a: "234", my_number: -12 })).toEqual({
        a: "234",
        my_number: -12,
      });
      expect(translator.getRecord({ a: "234", my_number: 23.3 })).toEqual({
        a: "234",
        my_number: 23.3,
      });
      expect(translator.getRecord({ a: "234", my_number: -23.3 })).toEqual({
        a: "234",
        my_number: -23.3,
      });
      expect(translator.getRecord({ a: "234", my_number: 0.3 })).toEqual({
        a: "234",
        my_number: 0.3,
      });
      expect(translator.getRecord({ a: "234", my_number: -0.3 })).toEqual({
        a: "234",
        my_number: -0.3,
      });
      expect(translator.getRecord({ a: "234", my_number: null })).toEqual({
        a: "234",
        my_number: null,
      });
      expect(translator.getRecord({ a: "234", my_number: undefined })).toEqual({
        a: "234",
        my_number: undefined,
      });
    });

    it("should translate integers stored in strings", () => {
      expect(translator.getRecord({ a: "234", my_number: "12" })).toEqual({
        a: "234",
        my_number: 12,
      });
      expect(translator.getRecord({ a: "234", my_number: " 12 " })).toEqual({
        a: "234",
        my_number: 12,
      });
      expect(translator.getRecord({ a: "234", my_number: " +12 " })).toEqual({
        a: "234",
        my_number: 12,
      });
      expect(translator.getRecord({ a: "234", my_number: "+12" })).toEqual({
        a: "234",
        my_number: 12,
      });
      expect(translator.getRecord({ a: "234", my_number: " -12 " })).toEqual({
        a: "234",
        my_number: -12,
      });
      expect(translator.getRecord({ a: "234", my_number: "-12" })).toEqual({
        a: "234",
        my_number: -12,
      });
    });

    it("should translate floats stored in stings", () => {
      expect(translator.getRecord({ a: "234", my_number: "23.12" })).toEqual({
        a: "234",
        my_number: 23.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "0.12" })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "+0.12" })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "-0.12" })).toEqual({
        a: "234",
        my_number: -0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "+.12" })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "-.12" })).toEqual({
        a: "234",
        my_number: -0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " 0.12" })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: "0.12  " })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " 0.12 " })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " +0.12 " })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " -0.12 " })).toEqual({
        a: "234",
        my_number: -0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " -.12 " })).toEqual({
        a: "234",
        my_number: -0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " .12 " })).toEqual({
        a: "234",
        my_number: 0.12,
      });
      expect(translator.getRecord({ a: "234", my_number: " +.12 " })).toEqual({
        a: "234",
        my_number: 0.12,
      });
    });

    it("should reject inputs that are not valid numbers", () => {
      expect(() => translator.getRecord({ a: "234", my_number: "f" })).toThrow(
        "Invalid number 'f' cannot be translated to a number"
      );
      expect(() =>
        translator.getRecord({ a: "234", my_number: "+-2" })
      ).toThrow("Invalid number '+-2' cannot be translated to a number");
      expect(() =>
        translator.getRecord({ a: "234", my_number: "+-.2" })
      ).toThrow("Invalid number '+-.2' cannot be translated to a number");
      expect(() =>
        translator.getRecord({ a: "123", my_number: "0x16" })
      ).toThrow("Invalid number '0x16' cannot be translated to a number");
      expect(() => translator.getRecord({ a: "123", my_number: "" })).toThrow(
        "Invalid number '' cannot be translated to a number"
      );
      expect(() => translator.getRecord({ a: "123", my_number: " " })).toThrow(
        "Invalid number ' ' cannot be translated to a number"
      );
      expect(() =>
        translator.getRecord({ a: "123", my_number: "3 1" })
      ).toThrow("Invalid number '3 1' cannot be translated to a number");
      expect(() => translator.getRecord({ a: "123", my_number: {} })).toThrow(
        "Invalid number '{}' cannot be translated to a number"
      );
      expect(() => translator.getRecord({ a: "123", my_number: [] })).toThrow(
        "Invalid number '[]' cannot be translated to a number"
      );
    });
  });

  describe("boolean translation", () => {
    const translator = new FaunaObjectTranslator(["my_boolean::bool"]);
    it("should translate any case-insensitve match of ['true', 't', 'yes', '1', 1, true] to true", () => {
      const trueValues = ["true", "t", "yes", "1", 1, true];
      trueValues.forEach((val) => {
        expect(translator.getRecord({ a: "123", my_boolean: val })).toEqual({
          a: "123",
          my_boolean: true,
        });
        if (typeof val === "string") {
          expect(
            translator.getRecord({ a: "123", my_boolean: val.toUpperCase() })
          ).toEqual({ a: "123", my_boolean: true });
        }
      });
    });

    it("should translate null and undefined as is", () => {
      expect(translator.getRecord({ a: "123", my_boolean: null })).toEqual({
        a: "123",
        my_boolean: null,
      });
      expect(translator.getRecord({ a: "123", my_boolean: undefined })).toEqual(
        {
          a: "123",
          my_boolean: undefined,
        }
      );
    });

    it("should translate any other value as false", () => {
      const falseValues = [{}, "wubba-lubba-dub-dub", 0, false];
      falseValues.forEach((val) => {
        expect(translator.getRecord({ a: "123", my_boolean: val })).toEqual({
          a: "123",
          my_boolean: false,
        });
      });
    });
  });

  describe("date translations", () => {
    const translator = new FaunaObjectTranslator([
      "my_date_string::dateString",
      "my_date_epoch_millis::dateEpochMillis",
      "my_date_epoch_seconds::dateEpochSeconds",
    ]);

    it("should translate valid ISO-8601 date strings to Fauna Time", () => {
      const validDates = [
        "2012",
        "2012-01-13",
        "2012-01-03T00:00:00.000Z",
        "2012-01-03T00:00:00.000Z",
        "2012-01-01T00:00:00+08:00",
      ];

      validDates.forEach((date) => {
        expect(
          translator.getRecord({ my_date_string: date, taco: "bell" })
        ).toEqual({
          my_date_string: q.Time(new Date(date).toISOString()),
          taco: "bell",
        });
      });
    });

    it("should translate valid RFC 2822 date strings to Fauna Time", () => {
      const validDates = [
        "Mon, 25 Dec 1995 13:30:00 GMT",
        "Tue, 26 Dec 1995 13:30:00 PDT",
      ];

      validDates.forEach((date) => {
        expect(
          translator.getRecord({ my_date_string: date, taco: "bell" })
        ).toEqual({
          my_date_string: q.Time(new Date(date).toISOString()),
          taco: "bell",
        });
      });
    });

    it("makes a best effort translation on non ISO-8601 date strings", () => {
      const psuedoDates = [
        "12",
        "2012/01/13",
        "May 13, 1958 12:12:00 PM",
        "1 January 2010",
      ];

      psuedoDates.forEach((date) => {
        expect(
          translator.getRecord({ my_date_string: date, taco: "bell" })
        ).toEqual({
          my_date_string: q.Time(new Date(date).toISOString()),
          taco: "bell",
        });
      });
    });

    it("should throw an error for invalid date strings", () => {
      const invalidTypes = [{}, [], 12];

      invalidTypes.forEach((date) => {
        expect(() =>
          translator.getRecord({ my_date_string: date, taco: "bell" })
        ).toThrow();
      });

      const invalidStrings = ["foo", "", " "];

      invalidStrings.forEach((val) => {
        expect(() =>
          translator.getRecord({ my_date_string: val, taco: "bell" })
        ).toThrow(`The string '${val}' cannot be translated to a date.`);
      });
    });

    it("should return null and undefined as is for all date translations", () => {
      expect(
        translator.getRecord({
          my_date_string: null,
          my_date_epoch_millis: null,
          my_date_epoch_seconds: null,
        })
      ).toEqual({
        my_date_string: null,
        my_date_epoch_millis: null,
        my_date_epoch_seconds: null,
      });
      expect(
        translator.getRecord({
          my_date_string: undefined,
          my_date_epoch_millis: undefined,
          my_date_epoch_seconds: undefined,
        })
      ).toEqual({
        my_date_string: undefined,
        my_date_epoch_millis: undefined,
        my_date_epoch_seconds: undefined,
      });
    });

    it("should translate epoch millis to Fauna Time", () => {
      const epochMillis = [1646873657123, "1646873657123"];
      epochMillis.forEach((epochMillis) => {
        expect(
          translator.getRecord({
            my_date_epoch_millis: epochMillis,
            taco: "bell",
          })
        ).toEqual({
          my_date_epoch_millis: q.Time("2022-03-10T00:54:17.123Z"),
          taco: "bell",
        });
      });
    });

    it("reject invalid epoch millis", () => {
      const invalidTypes = [{}, []];
      const invalidStrings = ["", " ", "foo"];

      invalidTypes.forEach((date) => {
        expect(() =>
          translator.getRecord({ my_date_epoch_millis: date, taco: "bell" })
        ).toThrow();
      });

      invalidStrings.forEach((date) => {
        expect(() =>
          translator.getRecord({ my_date_epoch_millis: date, taco: "bell" })
        ).toThrow();
      });
    });

    it("should translate epoch seconds to Fauna Time", () => {
      const epochSeconds = [1646873657, "1646873657"];
      epochSeconds.forEach((epochSeconds) => {
        expect(
          translator.getRecord({
            my_date_epoch_seconds: epochSeconds,
            taco: "bell",
          })
        ).toEqual({
          my_date_epoch_seconds: q.Time("2022-03-10T00:54:17.000Z"),
          taco: "bell",
        });
      });
    });

    it("reject invalid epoch seconds", () => {
      const invalidTypes = [{}, []];
      const invalidStrings = ["", " ", "foo"];

      invalidTypes.forEach((date) => {
        expect(() =>
          translator.getRecord({ my_date_epoch_seconds: date, taco: "bell" })
        ).toThrow();
      });

      invalidStrings.forEach((date) => {
        expect(() =>
          translator.getRecord({ my_date_epoch_seconds: date, taco: "bell" })
        ).toThrow();
      });
    });
  });
});
