import { useRef, useCallback, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";

// Thresholds — block if any flagged class exceeds these
const THRESHOLDS: Record<string, number> = {
  Porn: 0.3,
  Hentai: 0.3,
  Sexy: 0.5,
};

type NsfwResult = {
  isNsfw: boolean;
  flaggedCategories: string[];
};

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

function getModel(): Promise<nsfwjs.NSFWJS> {
  if (!modelPromise) {
    // Use the smaller MobileNetV2 model for faster load
    tf.enableProdMode();
    modelPromise = nsfwjs.load("MobileNetV2");
  }
  return modelPromise;
}

export function useNsfwCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const analyzeImage = useCallback(async (file: File): Promise<NsfwResult> => {
    setIsChecking(true);
    try {
      const model = await getModel();

      // Create an image element from the file
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      imgRef.current = img;

      const predictions = await model.classify(img);
      URL.revokeObjectURL(url);

      const flaggedCategories: string[] = [];
      for (const pred of predictions) {
        const threshold = THRESHOLDS[pred.className];
        if (threshold !== undefined && pred.probability > threshold) {
          flaggedCategories.push(pred.className);
        }
      }

      return {
        isNsfw: flaggedCategories.length > 0,
        flaggedCategories,
      };
    } catch (err) {
      console.warn("NSFW check failed, allowing through:", err);
      // Fail open on client side — server will catch it
      return { isNsfw: false, flaggedCategories: [] };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { analyzeImage, isChecking };
}
