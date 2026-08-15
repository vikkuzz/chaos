import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 22,
            height: 20,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: 22,
              height: 12,
              background: "#d97706",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              width: 6,
              height: 8,
              background: "#f59e0b",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 0,
              width: 6,
              height: 12,
              background: "#fbbf24",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 16,
              top: 4,
              width: 6,
              height: 8,
              background: "#f59e0b",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 9,
              bottom: 2,
              width: 4,
              height: 6,
              background: "#0f172a",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
