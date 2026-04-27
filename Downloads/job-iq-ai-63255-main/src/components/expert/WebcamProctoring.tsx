import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, CameraOff, Shield, AlertTriangle, CheckCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface WebcamProctoringProps {
  testId: string;
  expertId: string;
  isActive: boolean;
  onCaptureCountChange?: (count: number) => void;
  captureInterval?: number; // in seconds, default 1
}

export const WebcamProctoring = ({
  testId,
  expertId,
  isActive,
  onCaptureCountChange,
  captureInterval = 1 // Changed to 1 second default
}: WebcamProctoringProps) => {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Face detection (native Shape Detection API when available)
  const faceDetectorRef = useRef<any>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);
  const [faceDetected, setFaceDetected] = useState(true);
  const [noFaceWarnings, setNoFaceWarnings] = useState(0);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [faceApiAvailable, setFaceApiAvailable] = useState(false);

  // Request camera access
  const requestCameraAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait until metadata is ready so videoWidth/videoHeight are non-zero
        try {
          await videoRef.current.play();
        } catch {
          // ignore autoplay restrictions; user interaction might already exist
        }

        await new Promise<void>((resolve) => {
          const v = videoRef.current;
          if (v && v.readyState >= 2 && v.videoWidth > 0) return resolve();
          const handler = () => resolve();
          v?.addEventListener("loadedmetadata", handler, { once: true });
          // Safety timeout
          setTimeout(resolve, 1500);
        });
      }

      setHasPermission(true);
      setIsCapturing(true);
      toast.success(language === 'fr' ? "Webcam activée" : "Webcam enabled");
    } catch (error) {
      console.error("Camera access denied:", error);
      setHasPermission(false);
      toast.error(language === 'fr' ? "Accès à la webcam refusé" : "Webcam access denied");
    }
  }, [language]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  // Init native FaceDetector (Chrome / Edge)
  useEffect(() => {
    const FaceDetectorCtor = (window as any)?.FaceDetector;
    if (!FaceDetectorCtor) {
      setFaceApiAvailable(false);
      return;
    }

    try {
      faceDetectorRef.current = new FaceDetectorCtor({
        fastMode: true,
        maxDetectedFaces: 1,
      });
      setFaceApiAvailable(true);
    } catch (e) {
      console.warn("FaceDetector init failed, fallback to soft detection", e);
      faceDetectorRef.current = null;
      setFaceApiAvailable(false);
    }
  }, []);

  const runFaceDetection = useCallback(async (video: HTMLVideoElement) => {
    // Fallback: if FaceDetector isn't available, don't block the user with false negatives.
    if (!faceDetectorRef.current) {
      return { detected: true, confidence: 0, isFallback: true };
    }

    try {
      const faces = await faceDetectorRef.current.detect(video);
      const detected = Array.isArray(faces) && faces.length > 0;

      // FaceDetector doesn't provide confidence, so estimate from bounding box size
      let confidence = detected ? 100 : 0;
      const box = detected ? faces[0]?.boundingBox : null;
      if (detected && box && video.videoWidth && video.videoHeight) {
        const faceArea = (box.width || 0) * (box.height || 0);
        const frameArea = video.videoWidth * video.videoHeight;
        const ratio = frameArea > 0 ? faceArea / frameArea : 0;
        // Map typical ratios to 50-100 range
        confidence = Math.max(50, Math.min(100, Math.round(ratio * 800)));
      }

      return { detected, confidence, isFallback: false };
    } catch (e) {
      console.warn("FaceDetector.detect failed, fallback to soft detection", e);
      return { detected: true, confidence: 0, isFallback: true };
    }
  }, []);

  // Capture and upload image
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // If the video isn't ready yet, skip this tick (prevents false negatives)
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Run face detection on the live video element
    const detection = await runFaceDetection(video);

    setFaceDetected(detection.detected);
    setFaceConfidence(detection.confidence);

    // Only increment warnings when we have a real detector (avoid "always false" heuristics)
    if (!detection.isFallback) {
      if (!detection.detected) {
        setNoFaceWarnings((prev) => prev + 1);
      } else {
        setNoFaceWarnings((prev) => Math.max(0, prev - 1));
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
    });

    if (!blob) return;

    const timestamp = Date.now();
    const filename = `${expertId}/${testId}/${timestamp}.jpg`;

    const { error } = await supabase.storage
      .from("proctoring-captures")
      .upload(filename, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload proctoring capture:", error);
      return;
    }

    setCaptureCount((prev) => {
      const newCount = prev + 1;
      onCaptureCountChange?.(newCount);
      return newCount;
    });
    setLastCaptureTime(new Date());
  }, [isCapturing, testId, expertId, onCaptureCountChange, runFaceDetection]);

  // Auto-capture at intervals
  useEffect(() => {
    if (!isActive || !isCapturing) return;

    // Capture every interval (default 1 second)
    const interval = setInterval(() => {
      captureImage();
    }, captureInterval * 1000);

    // Initial capture after video loads
    const initialTimeout = setTimeout(() => {
      captureImage();
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [isActive, isCapturing, captureInterval, captureImage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-start if active
  useEffect(() => {
    if (isActive && hasPermission === null) {
      requestCameraAccess();
    }
  }, [isActive, hasPermission, requestCameraAccess]);

  if (!isActive) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Video preview */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Status overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isCapturing && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse mr-1.5" />
                {language === 'fr' ? 'Enregistrement' : 'Recording'}
              </Badge>
            )}
            {faceDetected && isCapturing && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                <User className="w-3 h-3 mr-1" />
                <CheckCircle className="w-3 h-3 mr-1" />
                {language === 'fr' ? `Visage détecté (${faceConfidence}%)` : `Face detected (${faceConfidence}%)`}
              </Badge>
            )}
            {!faceDetected && isCapturing && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {language === 'fr' ? 'Visage non détecté' : 'Face not detected'}
              </Badge>
            )}
          </div>

          {/* Capture count */}
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-black/50 text-white">
              <Camera className="w-3 h-3 mr-1" />
              {captureCount}
            </Badge>
          </div>

          {/* Face detection indicator ring */}
          <div
            className={`absolute inset-4 border-4 rounded-lg pointer-events-none transition-colors duration-300 ${
              faceDetected ? "border-success/40" : "border-destructive/40 animate-pulse"
            }`}
          />

          {/* No permission overlay */}
          {hasPermission === false && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center text-white p-4">
                <CameraOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {language === 'fr' 
                    ? "Accès webcam refusé"
                    : "Webcam access denied"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={requestCameraAccess}
                >
                  {language === 'fr' ? 'Réessayer' : 'Retry'}
                </Button>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {hasPermission === null && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center text-white p-4">
                <Camera className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                <p className="text-sm">
                  {language === 'fr' 
                    ? "Demande d'accès à la webcam..."
                    : "Requesting webcam access..."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="p-2 bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            <span>
              {language === 'fr' 
                ? `Capture chaque ${captureInterval}s`
                : `Capture every ${captureInterval}s`}
            </span>
          </div>
          {lastCaptureTime && (
            <span>
              {language === 'fr' ? 'Dernière: ' : 'Last: '}
              {lastCaptureTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Warnings */}
        {noFaceWarnings > 5 && (
          <Alert variant="destructive" className="m-2 mt-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {language === 'fr'
                ? `Visage non détecté ${Math.round(noFaceWarnings)} fois. Restez visible devant la caméra.`
                : `Face not detected ${Math.round(noFaceWarnings)} times. Stay visible in front of the camera.`}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default WebcamProctoring;
