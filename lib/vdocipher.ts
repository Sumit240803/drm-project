/**
 * VdoCipher OTP helper. Runs server-side only — the API secret must never
 * reach the browser.
 */

export interface VdoOtpResponse {
  otp: string;
  playbackInfo: string;
}

/**
 * Request a short-lived playback OTP for `videoId`, embedding the viewer's
 * email and IP as a dynamic on-screen watermark (the core traceability
 * feature). The IP is the viewer's address as seen at playback time.
 */
export async function getVdoOtp(
  videoId: string,
  viewerEmail: string,
  viewerIp: string
): Promise<VdoOtpResponse> {
  const apiSecret = process.env.VDOCIPHER_API_SECRET;
  if (!apiSecret) {
    throw new Error("VDOCIPHER_API_SECRET is not set");
  }

  const label = `${viewerEmail}  ·  ${viewerIp}`;

  // Two overlapping watermark layers make a recording much harder to crop the
  // identity out of: one larger roaming label that jumps position every few
  // seconds, plus a fainter persistent label that drifts on a different timer.
  // Both carry email + IP — this is the core traceability feature.
  const annotate = JSON.stringify([
    {
      type: "rtext",
      text: label,
      alpha: "0.70",
      color: "0xFF0000",
      size: "18",
      interval: "4000",
    },
    {
      type: "rtext",
      text: label,
      alpha: "0.35",
      color: "0xFFFFFF",
      size: "14",
      interval: "7000",
    },
  ]);

  const res = await fetch(
    `https://dev.vdocipher.com/api/videos/${encodeURIComponent(videoId)}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Apisecret ${apiSecret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ttl: 300, annotate }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text();
    // Log server-side only; never forward the secret or raw body to the client.
    console.error(
      `VdoCipher OTP request failed (${res.status} ${res.statusText}): ${body}`
    );
    throw new Error(`VdoCipher OTP request failed with status ${res.status}`);
  }

  const data = (await res.json()) as Partial<VdoOtpResponse>;
  if (!data.otp || !data.playbackInfo) {
    console.error("VdoCipher OTP response missing otp/playbackInfo:", data);
    throw new Error("VdoCipher OTP response was malformed");
  }

  return { otp: data.otp, playbackInfo: data.playbackInfo };
}
