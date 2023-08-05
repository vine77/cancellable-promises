/** Custom error used by AbortablePromise */
class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

/** A cancellable promise */
class AbortablePromise<T> {
  #abortController: AbortController;
  #abortReason?: string;
  #promise: Promise<T>;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
    ) => void,
  ) {
    this.#abortController = new AbortController();

    this.#promise = new Promise<T>((resolve, reject) => {
      this.#abortController.signal.addEventListener('abort', () => {
        reject(new AbortError(this.#abortReason ?? 'Promise was aborted.'));
      });

      executor(resolve, reject);
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
    if (!this.#abortController.signal.aborted) {
      this.#abortReason = reason;
      this.#abortController.abort();
    }
  }
}

/** Fake BLE SDK example */
enum TestType {
  LIPID_GLUCOSE = 'LIPID_GLUCOSE',
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
}

class Ble {
  sendRequest(testType: TestType) {
    return new AbortablePromise((resolve, reject) => {
      const operation = async () => {
        try {
          // Simulate the BLE operation
          const bleData = await new Promise((res) => {
            setTimeout(() => {
              console.log('end of BLE operation');
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
