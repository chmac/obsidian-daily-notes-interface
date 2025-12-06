import type { Moment } from "moment";
import { TFile } from "obsidian";

import {
  getDailyNoteSettings,
  getWeeklyNoteSettings,
  getMonthlyNoteSettings,
  getQuarterlyNoteSettings,
  getYearlyNoteSettings,
} from "./settings";

import { IGranularity } from "./types";
import { basename } from "./vault";

/**
 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
 * They are prefixed with the granularity to avoid ambiguity.
 */
export function getDateUID(
  date: Moment,
  granularity: IGranularity = "day"
): string {
  const ts = date.clone().startOf(granularity).format();
  return `${granularity}-${ts}`;
}

function removeEscapedCharacters(format: string): string {
  return format.replace(/\[[^\]]*\]/g, ""); // remove everything within brackets
}

/**
 * XXX: When parsing dates that contain both week numbers and months,
 * Moment choses to ignore the week numbers. For the week dateUID, we
 * want the opposite behavior. Strip the MMM from the format to patch.
 */
function isFormatAmbiguous(format: string, granularity: IGranularity) {
  if (granularity === "week") {
    const cleanFormat = removeEscapedCharacters(format);
    return (
      /w{1,2}/i.test(cleanFormat) &&
      (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat))
    );
  }
  return false;
}

export function getDateFromFile(
  file: TFile,
  granularity: IGranularity
): Moment | null {
  if (granularity === "week") {
    const format = getWeeklyNoteSettings().format;
    // Firstly, check if this path matches the week format because moment will
    // parse a date even if the format is completely wrong. To do this:
    // - Build a date for the weekly format year = 2025 and week = 01
    // - Then format that with the weekly formatting option
    // - Replace 2025 with [0-9]{4}
    // - Replace 01 with [0-9]{2}
    // - Convert that to a regex
    // - Match it against the path
    // - If it fails, then this is not a weekly note, return null now
    if (
      file.path.match(
        new RegExp(
          window
            .moment("2025-01-01")
            .format(format)
            .replace("2025", "[0-9]{4}")
            .replace("01", "[0-9]{2}")
        )
      ) === null
    ) {
      return null;
    }
    // Moment will only get the year correct, and match 1 Jan
    const dateWithOnlyCorrectYear = window.moment(file.path, format);
    const fileNameFormat = format.split("/").pop();
    const dateWithOnlyCorrectWeek = window.moment(
      file.basename,
      fileNameFormat
    );
    const weekNumber = dateWithOnlyCorrectWeek.format("ww");
    const date = dateWithOnlyCorrectYear
      .day("Monday")
      .week(parseInt(weekNumber));
    if (
      dateWithOnlyCorrectWeek.isValid() &&
      dateWithOnlyCorrectYear.isValid() &&
      date.isValid()
    ) {
      return date;
    }
    return null;
  }
  if (granularity === "quarter") {
    const format = getQuarterlyNoteSettings().format;
    const dateWithOnlyCorrectYear = window.moment(file.path, format);
    const fileNameFormat = format.split("/").pop();
    const dateWithOnlyCorrectQuarter = window.moment(
      file.basename,
      fileNameFormat
    );
    // Some date notes will be parsed as quarters
    const validationOutput = dateWithOnlyCorrectQuarter.format(fileNameFormat);
    const quarterNumber = dateWithOnlyCorrectQuarter.format("Q");
    const date = dateWithOnlyCorrectYear.quarter(parseInt(quarterNumber));
    if (
      validationOutput === file.basename &&
      dateWithOnlyCorrectYear.isValid() &&
      dateWithOnlyCorrectQuarter.isValid() &&
      date.isValid()
    ) {
      return date;
    }
    return null;
  }
  return getDateFromFilename(file.basename, granularity);
}

export function getDateFromPath(
  path: string,
  granularity: IGranularity
): Moment | null {
  return getDateFromFilename(basename(path), granularity);
}

function getDateFromFilename(
  filename: string,
  granularity: IGranularity
): Moment | null {
  const getSettings = {
    day: getDailyNoteSettings,
    week: getWeeklyNoteSettings,
    month: getMonthlyNoteSettings,
    quarter: getQuarterlyNoteSettings,
    year: getYearlyNoteSettings,
  };

  const format = getSettings[granularity]().format.split("/").pop();
  const noteDate = window.moment(filename, format, true);

  if (!noteDate.isValid()) {
    return null;
  }

  if (isFormatAmbiguous(format, granularity)) {
    if (granularity === "week") {
      const cleanFormat = removeEscapedCharacters(format);
      if (/w{1,2}/i.test(cleanFormat)) {
        return window.moment(
          filename,
          // If format contains week, remove day & month formatting
          format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""),
          false
        );
      }
    }
  }

  return noteDate;
}
