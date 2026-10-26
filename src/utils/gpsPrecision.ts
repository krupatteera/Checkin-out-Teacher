/**
 * High-Precision GPS Geolocation Utility
 * 
 * Solves mobile browser "coarse location" and "cell-tower jump" issues by:
 * 1. Multi-sample GPS convergence: samples geolocation over 3-6 seconds and retains the lowest accuracy error (meters).
 * 2. Filters out low-accuracy spikes (e.g. 100m cell tower readings overriding 8m satellite readings).
 * 3. Immediately completes once high-precision satellite lock is achieved (<= 15 meters).
 */

export interface PreciseGpsResult {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export function fetchPreciseGpsPosition(
  timeoutMs: number = 6000,
  targetAccuracy: number = 15
): Promise<PreciseGpsResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('เบราว์เซอร์ไม่รองรับ GPS'));
      return;
    }

    let bestSample: PreciseGpsResult | null = null;
    let watchId: number | null = null;
    let isDone = false;
    let timer: any = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
        watchId = null;
      }
    };

    const finish = () => {
      if (isDone) return;
      isDone = true;
      cleanup();

      if (bestSample) {
        resolve(bestSample);
      } else {
        // Fallback: one-shot high accuracy
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy || 20),
              timestamp: pos.timestamp || Date.now()
            });
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
      }
    };

    timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (isDone) return;
          const acc = Math.round(pos.coords.accuracy || 25);
          const sample: PreciseGpsResult = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: acc,
            timestamp: pos.timestamp || Date.now()
          };

          if (!bestSample || acc < bestSample.accuracy) {
            bestSample = sample;
          }

          // If we reached our target accuracy, complete immediately
          if (acc <= targetAccuracy) {
            finish();
          }
        },
        (err) => {
          console.warn('GPS convergence reading error:', err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: timeoutMs
        }
      );
    } catch {
      finish();
    }
  });
}
