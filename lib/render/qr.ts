import QRCode from "qrcode";

/**
 * Render a QR code as an inline SVG string.
 * Server-side only. Use inside Server Components via dangerouslySetInnerHTML
 * or pre-render to base64 if needed.
 */
export async function qrSvg(
  data: string,
  opts: { size?: number; margin?: number } = {},
): Promise<string> {
  const size = opts.size ?? 80;
  const margin = opts.margin ?? 1;
  // toString returns an SVG string when type="svg"
  const svg = await QRCode.toString(data, {
    type: "svg",
    margin,
    width: size,
    color: { dark: "#111111", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  return svg;
}
