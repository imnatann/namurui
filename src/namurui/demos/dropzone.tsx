import { Dropzone } from "../dropzone";

export default function Demo() {
  return (
    <div style={{ display: "grid", gap: 16, width: "100%" }}>
      <Dropzone accept={[".pdf", ".png", ".jpg", ".xlsx", ".docx", ".mp4"]} autoplay />
    </div>
  );
}
