import { useEffect, useRef, useState } from "react";
import { Camera, QrCode } from "lucide-react";

export default function QrScanner({ onScan, label = "Scan a check-in QR code" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }, []);

  async function startCamera() {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setError("QR camera scanning is not available in this browser. Paste the QR code below instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS and browser permission. Paste the QR code below instead.");
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setScanning(true);
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const matches = await detector.detect(videoRef.current);
          if (matches[0]?.rawValue) {
            setCode(matches[0].rawValue);
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setScanning(false);
          }
        } catch (scanError) {
          setError(`QR scan failed: ${scanError.message}`);
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setScanning(false);
        }
      };
      intervalRef.current = window.setInterval(() => { scan(); }, 350);
    } catch (cameraError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setScanning(false);
      setError(`Could not open the camera: ${cameraError.message}`);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setScanning(false);
  }

  function submit(event) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    let valueToSubmit = code.trim();
    if (valueToSubmit.startsWith("https://") || valueToSubmit.startsWith("http://")) {
      const parsed = new URL(valueToSubmit);
      valueToSubmit = parsed.searchParams.get("token") || parsed.searchParams.get("code") || valueToSubmit;
      setCode(valueToSubmit);
    }
    onScan(valueToSubmit);
  }

  return <form className="qr-scanner" onSubmit={submit}>
    <div className="qr-scanner-heading"><QrCode size={17} /><strong>{label}</strong></div>
    <label>Camera scan or paste the code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" /></label>
    <div className="qr-scanner-actions">
      <button className="button button-outline button-small" type="button" onClick={scanning ? stopCamera : startCamera}><Camera size={14} />{scanning ? "Stop camera" : "Use camera"}</button>
      <button className="button button-primary button-small" disabled={!code.trim()}>Check in</button>
    </div>
    <video ref={videoRef} className={scanning ? "qr-camera qr-camera-active" : "qr-camera"} playsInline muted aria-label="QR code camera view" />
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
