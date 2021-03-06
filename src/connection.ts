var EventEmitter2 = require('eventemitter2').EventEmitter2;

import Logger from './utils/logger';

export default class Connection extends EventEmitter2 {
  private lastId: number;
  private vscode: any;
  private callbacks: Map<number, object>;
  private logger: Logger;

  constructor() {
    super();
    this.lastId = 0;
    this.callbacks = new Map();
    this.logger = new Logger();

    window.addEventListener('message', (event) => {
      this.onMessage(event);
    });
  }

  send(method: string, params = {}): Promise<object> {
    const id = ++this.lastId;

    this.logger.log('SEND ► ', method, params);

    if (!this.vscode) {
      try {
        // @ts-ignore
        this.vscode = acquireVsCodeApi();
      } catch {
        this.vscode = null;
      }
    }

    if (this.vscode) {
      this.vscode.postMessage({
        callbackId: id,
        params,
        type: method
      });
    }

    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject, error: new Error(), method });
    });
  }

  onMessage(message: any) {
    const object: any = message.data;

    if (object) {
      if (object.callbackId) {
        this.logger.log(`◀ RECV callbackId: ${object.callbackId}`);
        const callback: any = this.callbacks.get(object.callbackId);
        // Callbacks could be all rejected if someone has called `.dispose()`.
        if (callback) {
          this.callbacks.delete(object.callbackId);
          if (object.error) {
            callback.reject(callback.error, callback.method, object);
          } else {
            callback.resolve(object.result);
          }
        }
      } else {
        this.logger.log(`◀ RECV method: ${object.method}`);
        this.emit(object.method, object.result);
      }
    }
  }

  setLoggingMode(verbose: boolean) {
    if (verbose) {
      this.logger.enable();
    } else {
      this.logger.disable();
    }
  }
}
