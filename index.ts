/** Custom error used by AbortablePromise */
class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

/** A cancellable promise */
class AbortablePromise<T> {
  #abortReason?: string;
  #promise: Promise<T>;
  #onCancel?: () => void;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
      onCancel: (callback: () => void) => void,
    ) => void,
  ) {
    this.#promise = new Promise<T>((resolve, reject) => {
      executor(resolve, reject, (cancelFn) => {
        this.#onCancel = cancelFn;
      });
    });
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined,
  ): Promise<T | TResult> {
    return this.#promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined): Promise<T> {
    return this.#promise.finally(onfinally);
  }

  abort(reason: string = 'Promise was aborted.') {
    if (this.#onCancel) {
      this.#onCancel();
      this.#onCancel = undefined; // Ensure the cancel function can't be called more than once.
    }
    // We manually reject the promise after running the onCancel callback.
    this.#abortReason = reason;
    this.#promise.catch(() => {}); // Catch the rejection to avoid unhandled rejection error.
  }
}

/** Fake BLE SDK example */
enum TestType {
  LIPID_GLUCOSE = 'LIPID_GLUCOSE',
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
}

class Ble {
  sendRequest(testType: TestType) {
    return new AbortablePromise((resolve, reject, onCancel) => {
      let timerId: number;

      onCancel(() => {
        clearTimeout(timerId);
        console.log('BLE operation cancelled');
        reject(new AbortError('Promise was aborted.'));
      });

      const operation = async () => {
        try {
          const bleData = await new Promise((res) => {
            timerId = setTimeout(() => {
              console.log('BLE operation finished');
              res({ data: 50, testType });
            }, 3000);
          });
          resolve(bleData);
        } catch (error) {
          reject({
            errorType: 'OPERATION_ERROR',
            description: error,
          });
        }
      };

      operation();
    });
  }
}

/** Fake app consumer of BLE SDK example */
async function app() {
  try {
    const ble = new Ble();
    const request = ble.sendRequest(TestType.BLOOD_PRESSURE);
    setTimeout(() => {
      request.abort('User initiated abort.');
    }, 1000);
    const response = await request;
    console.log(`Response: ${JSON.stringify(response)}`);
  } catch (error) {
    if (error instanceof AbortError) {
      console.warn(`Aborted: ${error.message}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
  }
}

app();
