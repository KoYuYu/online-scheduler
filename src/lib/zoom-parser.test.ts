import { describe, expect, it } from "vitest";
import { parseZoomInvite } from "@/lib/zoom-parser";

const sampleInvite = `Susan Reid邀请你参加已安排的Zoom会议。

主题: Hongfei Wang-Interview
时间: 2026年6月17日 04:30 下午 太平洋时间（美国和加拿大）
加入Zoom会议
https://us05web.zoom.us/j/88116134191?pwd=RaUmalAKPaMMgBbeqIBctMcgbLdcja.1

会议聊天链接
https://us05web.zoom.us/launch/jc/88116134191

会议号: 881 1613 4191
密码: UTb1YG`;

const offHourEasternInvite = `主题: Oscar - Jason- system design
时间: 2026年6月17日 10:15 下午 东部时间（美国和加拿大）
加入Zoom会议
https://drillinsight.zoom.us/j/82151357096?pwd=Txci3tpddIT7Kb105JlaveEf46oEci.1

会议聊天链接
https://drillinsight.zoom.us/launch/jc/82151357096

使用Zoom AI Companion查看会议洞察
https://drillinsight.zoom.us/launch/edl?muid=2de96d43-18e1-41dc-aa4c-a32609015f9d

会议号: 821 5135 7096
密码: 990707`;

const missingTimeZoneInvite = `主题: 时区待确认会议
时间: 2026年6月17日 04:30 下午
加入Zoom会议
https://us05web.zoom.us/j/88116134191?pwd=RaUmalAKPaMMgBbeqIBctMcgbLdcja.1`;

describe("parseZoomInvite", () => {
  it("extracts key Zoom fields from a Chinese invite", () => {
    const parsed = parseZoomInvite(sampleInvite);
    expect(parsed.invitedByName).toBe("Susan Reid");
    expect(parsed.title).toBe("Hongfei Wang-Interview");
    expect(parsed.zoomJoinUrl).toBe("https://us05web.zoom.us/j/88116134191?pwd=RaUmalAKPaMMgBbeqIBctMcgbLdcja.1");
    expect(parsed.meetingId).toBe("881 1613 4191");
    expect(parsed.passcode).toBe("UTb1YG");
  });

  it("converts Pacific time to Eastern time and adds a one-hour slot", () => {
    const parsed = parseZoomInvite(sampleInvite);
    expect(parsed.startAtUtc).toBe("2026-06-17T23:30:00.000Z");
    expect(parsed.endAtUtc).toBe("2026-06-18T00:30:00.000Z");
    expect(parsed.easternTimeLabel).toBe("7:30 PM - 8:30 PM ET");
  });

  it("parses off-hour Eastern Zoom invite times", () => {
    const parsed = parseZoomInvite(offHourEasternInvite);
    expect(parsed.title).toBe("Oscar - Jason- system design");
    expect(parsed.zoomJoinUrl).toBe("https://drillinsight.zoom.us/j/82151357096?pwd=Txci3tpddIT7Kb105JlaveEf46oEci.1");
    expect(parsed.meetingId).toBe("821 5135 7096");
    expect(parsed.passcode).toBe("990707");
    expect(parsed.startAtUtc).toBe("2026-06-18T02:15:00.000Z");
    expect(parsed.endAtUtc).toBe("2026-06-18T03:15:00.000Z");
    expect(parsed.easternTimeLabel).toBe("10:15 PM - 11:15 PM ET");
  });

  it("requires a user-selected timezone when the invite does not include one", () => {
    const unconfirmed = parseZoomInvite(missingTimeZoneInvite);
    const confirmed = parseZoomInvite(missingTimeZoneInvite, 60, "America/Los_Angeles");

    expect(unconfirmed.timeZoneConfirmed).toBe(false);
    expect(unconfirmed.timeZoneSource).toBe("missing");
    expect(unconfirmed.startAtUtc).toBe("2026-06-17T20:30:00.000Z");
    expect(confirmed.timeZoneConfirmed).toBe(true);
    expect(confirmed.timeZoneSource).toBe("user");
    expect(confirmed.sourceTimeZone).toBe("America/Los_Angeles");
    expect(confirmed.startAtUtc).toBe("2026-06-17T23:30:00.000Z");
  });
});
