import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export class PoseDetectorService {
  private static instance: PoseDetectorService | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitializing = false;
  private initError: string | null = null;

  public static getInstance(): PoseDetectorService {
    if (!PoseDetectorService.instance) {
      PoseDetectorService.instance = new PoseDetectorService();
    }
    return PoseDetectorService.instance;
  }

  public get isReady(): boolean {
    return this.poseLandmarker !== null;
  }

  public get error(): string | null {
    return this.initError;
  }

  public async initialize(): Promise<PoseLandmarker> {
    if (this.poseLandmarker) {
      return this.poseLandmarker;
    }

    if (this.isInitializing) {
      // Wait until initialization completes
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.poseLandmarker) return this.poseLandmarker;
      throw new Error(this.initError || 'PoseLandmarker initialization failed');
    }

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load vision wasm binaries strictly from local server
      const vision = await FilesetResolver.forVisionTasks('/wasm');

      // Attempt GPU delegate first, fallback to CPU
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed for PoseLandmarker, falling back to CPU:', gpuError);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      this.isInitializing = false;
      return this.poseLandmarker;
    } catch (err: any) {
      this.isInitializing = false;
      this.initError = err?.message || 'Failed to initialize Pose Landmarker';
      throw new Error(this.initError!);
    }
  }

  public detectForVideo(video: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult | null {
    if (!this.poseLandmarker || video.readyState < 2) {
      return null;
    }
    try {
      return this.poseLandmarker.detectForVideo(video, timestampMs);
    } catch (e) {
      console.error('Inference error in detectForVideo:', e);
      return null;
    }
  }

  public close() {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
  }
}
