#!/usr/bin/python
# -*- encoding=utf8 -*-
# Copyright (c) 2009-10 froglogic GmbH. All rights reserved.
# This file is part of an example program for Squish---it may be used,
# distributed, and modified, without limitation.

from __future__ import nested_scopes
from __future__ import generators
from __future__ import division

import codecs
import datetime
import optparse
import json
import os
import re
import sys
import time
import xml.sax
import xml.sax.saxutils
if sys.platform.startswith("win"):
    import glob

if sys.version_info[0] != 2 or (
   sys.version_info[0] == 2 and sys.version_info[1] < 4):
    print """%s: error: this program requires \
Python 2.4, 2.5, 2.6, or 2.7;
it cannot run with python %d.%d.
Try running it with the Python interpreter that ships with squish, e.g.:
C:\> C:\\squish\\squish-4.0.1-windows\\python\python.exe %s
""" % (os.path.basename(sys.argv[0]),
       sys.version_info[0], sys.version_info[1],
       os.path.basename(sys.argv[0]))
    sys.exit(1)


suite_json = {"test_cases":[]}
escape = None
datetime_from_string = None

CONSOLE_SUMMARY = None

class ReportError(Exception): pass

class ConsoleSummary():
    def __init__(self, reporter):
        self.suite_passes            = reporter.suite_passes
        self.suite_fails             = reporter.suite_fails
        self.suite_fatals            = reporter.suite_fatals
        self.suite_errors            = reporter.suite_errors
        self.suite_expected_fails    = reporter.suite_expected_fails
        self.suite_unexpected_passes = reporter.suite_unexpected_passes
        self.suite_tests             = reporter.suite_tests
        self.suite_cases             = reporter.suite_cases

    def __str__(self):
        output = "\n*******************************************************\n"
        output += "Summary:\n"
        output += "Number of Test Cases:        " + str(self.suite_cases) + "\n"
        output += "Number of Tests:             " + str(self.suite_tests) + "\n"
        output += "Number of Passes:            " + str(self.suite_passes) + "\n"
        output += "Number of Fails:             " + str(self.suite_fails) + "\n"
        output += "Number of Errors:            " + str(self.suite_errors) + "\n"
        output += "Number of Fatals:            " + str(self.suite_fatals) + "\n"
        output += "Number of Expected Fails:    " + str(self.suite_expected_fails) + "\n"
        output += "Number of Unexpected Passes: " + str(self.suite_unexpected_passes) + "\n"
        output += "*******************************************************\n"

        return output

# shoe-in class for the opts crap.  Need to run the main through another python script, options make this absurdely difficult
class Options():
    def __init__(self):
        self.dir      = "."
        self.iso      = True
        self.preserve = False
        self.verbose  = False

class SquishReportHandler(xml.sax.handler.ContentHandler):
    def __init__(self, opts, fh):
        xml.sax.handler.ContentHandler.__init__(self)
        if opts.preserve:
            self.valign = "middle"
        else:
            self.valign = "top"

        self.tstCase_json            = {"tests":[]}
        self.test_json               = {}
        self.preserve                = opts.preserve
        self.fh                      = fh
        self.details_fh              = None
        self.in_report               = False
        self.in_suite                = False
        self.in_case                 = False
        self.in_test                 = False
        self.in_result               = False
        self.in_description          = False
        self.in_detailed_description = False
        self.in_message              = False
        self.suite_start             = None
        self.suite_passes            = 0
        self.suite_fails             = 0
        self.suite_fatals            = 0
        self.suite_errors            = 0
        self.suite_expected_fails    = 0
        self.suite_unexpected_passes = 0
        self.suite_tests             = 0
        self.suite_cases             = 0
        self.suite_name              = None
        self.case_name               = None
        self.current_case            = None
        self.current_caseNumber      = 0
        self.result_type             = None
        self.result_time             = None
        self.description             = []
        self.detailed_description    = []
        self.message_type            = None
        self.message_time            = None
        self.message                 = []
        self.opts                    = None
        self.testcase_pass           = True
        self.testcase_color          = u"#90ee90"
        self.attribute_time          = None
        self.testcase_errors         = 0
        self.testcase_fails          = 0
        self.testcase_fatals         = 0
        self.testcase_expectedFails  = 0
        self.testcase_warnings       = 0
        self.testcase_unexpectedPass = 0

    def startElement(self, name, attributes):
        if name == u"SquishReport":
            version = attributes.get(u"version").split(".")
            if not version or int(version[0]) < 2:
                raise ReportError("unrecognized Squish Report version; "
                        "try using squishrunner's xml2.1 report-generator")
            self.in_report = True
            return
        elif not self.in_report:
            raise ReportError("unrecognized XML file")
        if name == u"test":
            if not self.in_suite:
                self.suite_name = escape(attributes.get("name") or "Suite")
                self.in_suite = True
            else:
                if self.in_case:
                    raise ReportError("nested tests are not supported")
                self.case_name = attributes.get("name" or "Test")
                self.suite_cases += 1
                self.in_case = True
        elif name == u"prolog":
            if self.in_case:
                if self.case_name != self.current_case:
                    self.createDetailsPage(attributes)
            elif self.in_suite:
                self.suite_start = datetime_from_string(attributes.get("time"))
        elif name == u"epilog":
            # We ignore epilog times
            pass
        elif name == u"verification":
            line = attributes.get("line") or ""
            if line:
                line = "#" + line
            filename = attributes.get("file") or ""
            if filename:
                filename  = os.path.normpath(filename)
                _filename = os.path.basename(filename)
                _tstcase  = os.path.basename(filename[:-(len(_filename)+1)])
                filename  = os.path.join(_tstcase, _filename)

            filename_and_line = filename + ": " + line

            self.test_json["name"] = name
            self.test_json["filename_and_line"] = filename_and_line
        elif name == u"result":
            self.result_type = attributes.get("type")
            self.result_time = datetime_from_string(attributes.get("time"))
            self.suite_tests += 1
            if self.result_type == u"PASS":
                self.suite_passes += 1
            elif self.result_type == u"FAIL":
                self.suite_fails += 1
                self.testcase_fails += 1
            elif self.result_type == u"FATAL":
                self.suite_fatals += 1
            elif self.result_type == u"ERROR":
                self.suite_errors += 1
            elif self.result_type in (u"XPASS", u"UPASS"):
                self.suite_unexpected_passes += 1
                self.testcase_unexpectedPass += 1
            elif self.result_type == u"XFAIL":
                self.suite_expected_fails += 1
                self.testcase_expectedFails += 1
            self.in_result = True
        elif name == u"description":
            if not (self.in_result or self.in_message):
                raise ReportError("misplaced description")
            self.in_description = False
            self.in_detailed_description = False
            type = attributes.get("type")
            if not type or type != u"DETAILED":
                self.in_description = True
            else:
                self.in_detailed_description = True
        elif name == u"message":
            self.message_type = attributes.get("type")
            if self.message_type == u"FATAL":
                self.suite_fatals += 1
            elif self.message_type == u"ERROR":
                self.suite_errors += 1
            self.message_time = datetime_from_string(attributes.get("time"))
            self.in_message = True


    def characters(self, text):
        if self.in_message and not (self.in_description or self.in_detailed_description):
            self.message.append(text)
        elif self.in_description:
            self.description.append(text)
        elif self.in_detailed_description:
            self.detailed_description.append(text)


    def endElement(self, name):
        if name == u"SquishReport":
            if self.details_fh != None:
                self.closeDetailsFH()
        elif name == u"test":
            if self.in_test:
                self.in_test = False
            elif self.in_case:
                self.in_case = False
        elif name == u"prolog":
            pass
        elif name == u"epilog":
            # We ignore epilog times
            pass
        elif name == u"verification":
            pass
        elif name == u"result":
            detailed_description = escape_and_handle_image(
                    "".join(self.detailed_description), self.preserve)
            description = escape_and_handle_image(
                    "".join(self.description), self.preserve)

            thisResultClass = "normal"
            if self.result_type == u"ERROR" or self.result_type == u"FATAL" or self.result_type == u"FAIL":
                thisResultClass = "defect"

            self.test_json["result"]      = self.result_type
            self.test_json["result_time"] = self.result_time
            self.test_json["description"] = description
            self.test_json["detailed_description"] = detailed_description
            self.tstCase_json["tests"].append(self.test_json)

            self.test_json  = {}
            self.result_type = None
            self.result_time = None
            self.description = []
            self.detailed_description = []
            self.in_result = False
        elif name == u"description":
            if self.in_detailed_description:
                self.in_detailed_description = False
            elif self.in_description:
                self.in_description = False
        elif name == u"message":
            if self.message_type == u"WARNING":
                self.testcase_warnings += 1
            if self.message_type == u"ERROR":
                self.testcase_errors += 1
            elif self.message_type == u"FATAL":
                self.testcase_fatals += 1
            msg = self.message
            detail_msg = ""
            if (len("".join(self.message).strip()) == 0 and
                len(self.description) > 0):
                msg = self.description
                detail_msg = self.detailed_description
                self.description = []
                self.detailed_description = []
            msg = escape_and_handle_image("".join(msg), self.preserve)
            detail_msg = escape_and_handle_image("".join(detail_msg),
                    self.preserve)

            thisResultClass = "normal"
            if self.message_type == u"ERROR" or self.message_type == u"FATAL":
                thisResultClass = "defect"

            self.test_json["message_type"]     = self.message_type
            self.test_json["message_time"]     = self.message_time
            self.test_json["message"]          = msg
            self.test_json["detailed_message"] = detail_msg
            self.tstCase_json["tests"].append(self.test_json)

            self.test_json  = {}
            self.message    = []
            self.in_message = False

    def closeDetailsFH(self):
        faultSummary   = ""
        tstCase_result = "PASS"
        if self.testcase_warnings > 0:
            faultSummary += " Warnings: " + str(self.testcase_warnings)
            tstCase_result = "WARNING"
        if self.testcase_unexpectedPass > 0:
            faultSummary += " Unexpected Passes: " + str(self.testcase_unexpectedPass)
            tstCase_result = "uPASS"
        if self.testcase_fails > 0:
            faultSummary += "Fails: " + str(self.testcase_fails)
            tstCase_result = "FAIL"
        if self.testcase_errors > 0:
            faultSummary += " Errors: " + str(self.testcase_errors)
            tstCase_result = "ERROR"
        if self.testcase_fatals > 0:
            faultSummary += " Fatals: " + str(self.testcase_fatals)
            tstCase_result = "FATAL"
        if self.testcase_expectedFails > 0:
            faultSummary += " Expected Failures: " + str(self.testcase_expectedFails)

        self.current_caseNumber += 1

        self.tstCase_json["number"]  = self.current_caseNumber
        self.details_fh.write(json.dumps(self.tstCase_json))
        self.details_fh.close()
        self.tstCase_json = {"tests":[]}

        tstCase_summary = {
            'number': self.current_caseNumber,
            'name': self.current_case,
            'time': datetime_from_string(self.attribute_time),
            'fault_summary': faultSummary,
            'result': tstCase_result
        }

        global suite_json
        suite_json["test_cases"].append(tstCase_summary)

        self.testcase_color = u"#90ee90"
        self.testcase_fails = 0
        self.testcase_errors = 0
        self.testcase_fatals = 0
        self.testcase_expectedFails = 0
        self.testcase_warnings = 0
        self.testcase_unexpectedPass = 0

    def createDetailsPage(self, attributes):
        if self.details_fh != None:
            self.closeDetailsFH()

        self.current_case = self.case_name
        self.attribute_time = attributes.get("time")
        details_file = os.path.abspath(os.path.join(self.opts.dir, os.path.basename(self.case_name + ".json")))
        try:
            self.details_fh = codecs.open(details_file, "w", encoding="utf-8")
            self.tstCase_json["name"] = self.case_name
        except (EnvironmentError, ValueError, ReportError, xml.sax.SAXParseException), err:
            print >>sys.stderr, err

def escape_and_handle_image(description, preserve):
    match = re.search(ur"""saved\s+as\s+['"](?P<image>[^'"]+)['"]""",
            description, re.IGNORECASE)
    if match is None:
        match = re.search(
                ur"""screenshot\s+in\s+['"](?P<image>[^'"]+)['"]""",
                description, re.IGNORECASE)
    if match:
        before = escape(description[:match.start()])
        image = match.group("image")
        after = escape(description[match.end():])
        description = '%s <a href="file://%s">%s</a> %s' % (
                before, image, image, after)
        if preserve:
            description = "<pre>%s</pre>" % description
    else:
        description = escape(description, True)
    return description


def process_suite(opts, filename, index_fh=None):
    extension = os.path.splitext(filename)[1]
    json_file = os.path.abspath(os.path.join(opts.dir, os.path.basename("suite.json")))
    if opts.preserve:
        valign = "middle"
    else:
        valign = "top"
    fh = None
    try:
        try:
            fh = codecs.open(json_file, "w", encoding="utf-8")
            reporter = SquishReportHandler(opts, fh)
            reporter.opts = opts
            parser = xml.sax.make_parser()
            parser.setContentHandler(reporter)
            parser.parse(filename)
            write_summary_entry(valign, reporter, json_file)
        except (EnvironmentError, ValueError, ReportError, xml.sax.SAXParseException), err:
            print >>sys.stderr, err
    finally:
        if fh is not None:
            fh.close()


def write_summary_entry(valign, reporter, json_file):
    global CONSOLE_SUMMARY
    CONSOLE_SUMMARY = ConsoleSummary(reporter)

    global suite_json
    suite_json["suite_name"] = reporter.suite_name

    suite_json["job"] = {}
    for attr, jjValue in sorted(JENKINSJOB.__dict__.iteritems()):
        if str(jjValue) != "none":
            suite_json["job"][attr] = str(jjValue)

    suite_json["summary"] = {}
    suite_json["summary"]["start_time"]        = reporter.suite_start
    suite_json["summary"]["passes"]            = reporter.suite_passes
    suite_json["summary"]["fails"]             = reporter.suite_fails
    suite_json["summary"]["fatals"]            = reporter.suite_fatals
    suite_json["summary"]["errors"]            = reporter.suite_errors
    suite_json["summary"]["expected_fails"]    = reporter.suite_expected_fails
    suite_json["summary"]["unexpected_passes"] = reporter.suite_unexpected_passes
    suite_json["summary"]["tests"]             = reporter.suite_tests
    suite_json["summary"]["cases"]             = reporter.suite_cases

    fh = None
    try:
        fh = open(json_file, "r+b")
        fh.write(json.dumps(suite_json))
    finally:
        if fh is not None:
            fh.close()

def create_functions(opts):
    global escape
    if not opts.preserve:
        def function(s, is_multiline=False):
            return (xml.sax.saxutils.escape(s).strip().replace("\\n", "\n").replace("\n", "<br/>"))
    else:
        def function(s, is_multiline=False):
            if is_multiline:
                return "<pre>%s</pre>" % (xml.sax.saxutils.escape(s).replace("\\n", "\n").strip())
            else:
                return xml.sax.saxutils.escape(s).replace("\\n", "\n").strip()
    escape = function

    global datetime_from_string
    if not opts.iso:
        # Sadly, Python doesn't properly support time zones out of the box
        def function(s):
            if s is None:
                return ""
            return time.asctime(time.strptime(s[:19],
                    "%Y-%m-%dT%H:%M:%S")).replace(" ", "&nbsp;")
    else:
        def function(s):
            if s is None:
                return ""
            return s
    datetime_from_string = function


def main(args=None):
    if args is None:
        args = sys.argv

    global JENKINSJOB
    JENKINSJOB = args[2]

    opts = Options()
    opts.dir = args[1]

    if sys.platform.startswith("win"):
        temp = []
        for arg in args:
            temp.extend(glob.glob(arg))
        args = temp

    create_functions(opts)

    if not os.path.exists(opts.dir):
        os.makedirs(opts.dir)

    fh = None
    try:
        process_suite(opts, args[0], fh)
    finally:
        if fh is not None:
            fh.close()

    return CONSOLE_SUMMARY

if __name__ == "__main__":
    sys.exit(main())