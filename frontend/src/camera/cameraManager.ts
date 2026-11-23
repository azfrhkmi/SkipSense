export interface CameraConfig {
  idealWidth: number;
  idealHeight: number;
  facingMode: 'user' | 'environment';
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  idealWidth: 1280,
  idealHeight: 720,
  facingMode: 'user',
};

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private config: CameraConfig;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
  }

  public async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.stopCamera();
    this.videoElement = videoElement;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Camera API (getUserMedia) is not supported in this browser. Please ensure you are accessing via HTTPS.'
      );
    }

    try {
      // 1. Try target 1280x720 resolution with front-facing camera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: this.config.facingMode },
          width: { ideal: this.config.idealWidth },
          height: { ideal: this.config.idealHeight },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (primaryErr: any) {
      console.warn('Primary camera resolution 1280x720 failed, attempting 640x480 fallback:', primaryErr);
      try {
        // Fallback to 640x480
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.config.facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (fallbackErr: any) {
        throw this.formatCameraError(fallbackErr);
      }
    }

    videoElement.srcObject = this.stream;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = true;

    await new Promise<void>((resolve, reject) => {
      videoElement.onloadedmetadata = () => {
        videoElement
          .play()
          .then(() => resolve())
          .catch((err) => reject(this.formatCameraError(err)));
      };
      videoElement.onerror = (e) => reject(this.formatCameraError(e));
    });

    return this.stream;
  }

  public stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public get isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  private formatCameraError(err: any): Error {
    const errorName = err?.name || '';
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return new Error('Camera access was denied. Please allow camera permissions in Safari / browser settings and reload.');
    }
    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      return new Error('No front-facing camera was found on this device.');
    }
    if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      return new Error('Camera is already in use by another application or tab.');
    }
    if (errorName === 'OverconstrainedError') {
      return new Error('Requested camera resolution is not supported by your hardware.');
    }
    return new Error(err?.message || 'Failed to initialize camera. Ensure you are on HTTPS.');
  }
}
