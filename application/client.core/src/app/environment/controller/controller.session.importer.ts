import { IImportedData, Importable } from './controller.session.importer.interface';
import { IPCMessages, Subscription as IPCSubscription } from '../services/service.electron.ipc';
import { Subscription } from 'rxjs';
import { getHash } from './helpers/hash';

import ServiceElectronIpc from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionImporter {

    private _controllers: Importable<any>[];
    private _logger: Toolkit.Logger;
    private _session: string;
    private _subscriptions: { [key: string]: IPCSubscription | Subscription } = {};
    private _lastOperationHash: string = '';

    constructor(session: string, controllers: Importable<any>[]) {
        this._logger = new Toolkit.Logger(`ControllerSessionImporter ${session}`);
        this._controllers = controllers;
        this._session = session;
        this._subscriptions.FileOpenDoneEvent = ServiceElectronIpc.subscribe(IPCMessages.FileOpenDoneEvent, this._onFileOpenDoneEvent.bind(this));
        this._controllers.forEach((controller: Importable<any>) => {
            this._subscriptions[controller.getImporterUUID()] = controller.getExportObservable().subscribe(this._onExportTriggered.bind(this));
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public export(): Promise<void> {
        return new Promise((resolve, reject) => {
            const toBeExported: IPCMessages.ISessionImporterData[] = [];
            Promise.all(this._controllers.map((controller: Importable<any>) => {
                return new Promise((res) => {
                    controller.export().then((data: any | undefined) => {
                        if (data !== undefined) {
                            const stringified: string = JSON.stringify(data);
                            // const utf8Encode = new TextEncoder();
                            // utf8Encode.encode(stringified);
                            toBeExported.push({
                                hash: getHash(stringified),
                                data: stringified,
                                controller: controller.getImporterUUID(),
                            });
                        }
                    }).catch((err: Error) => {
                        this._logger.warn(`Fail to export data for "${controller.getImporterUUID()}" due error: ${err.message}`);
                    }).finally(res);
                });
            })).then(() => {
                if (!this._isActualOperation(toBeExported)) {
                    return resolve();
                }
                ServiceElectronIpc.request(new IPCMessages.SessionImporterSaveRequest({
                    session: this._session,
                    data: toBeExported,
                }), IPCMessages.SessionImporterSaveResponse).then((response: IPCMessages.SessionImporterSaveResponse) => {
                    if (response.error !== undefined) {
                        reject(new Error(this._logger.warn(`Fail to export data due error: ${response.error}`)));
                    } else {
                        resolve();
                    }
                }).catch((err: Error) => {
                    reject(new Error(this._logger.warn(`Fail to export data due error: ${err.message}`)));
                });
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail to finish export due error: ${err.message}`)));
            });

        });
    }

    public import(): Promise<void> {
        function getDataFromStr(str: string): any | Error {
            try {
                return JSON.parse(str);
            } catch (e) {
                return e;
            }
        }
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPCMessages.SessionImporterLoadRequest({
                session: this._session,
            }), IPCMessages.SessionImporterLoadResponse).then((response: IPCMessages.SessionImporterLoadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.warn(`Fail to import data due error: ${response.error}`)));
                }
                if (response.data === undefined) {
                    return resolve();
                }
                Promise.all(response.data.map((pack: IPCMessages.ISessionImporterData) => {
                    return new Promise((res) => {
                        const controller: Importable<any> | undefined = this._controllers.find(c => c.getImporterUUID() === pack.controller);
                        if (controller === undefined) {
                            this._logger.warn(`Fail to find controller for "${pack.controller}". Fail to import data for it.`);
                            return res();
                        }
                        if (getHash(pack.data) !== pack.hash) {
                            this._logger.warn(`Fail to parse data for "${pack.controller}" because of hash dismatch`);
                            return res();
                        }
                        const parsed: any | Error = getDataFromStr(pack.data);
                        if (parsed instanceof Error) {
                            this._logger.warn(`Fail to parse data for "${pack.controller}" due error: ${parsed.message}`);
                            return res();
                        }
                        controller.import(parsed).catch((err: Error) => {
                            this._logger.warn(`Fail import data for "${pack.controller}" due error: ${err.message}`);
                        }).finally(res);
                    });
                })).then(() => {
                    resolve();
                }).catch((err: Error) => {
                    reject(new Error(this._logger.warn(`Fail to finish import due error: ${err.message}`)));
                });
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail to import data due error: ${err.message}`)));
            });
        });
    }

    private _isActualOperation(toBeExported: IPCMessages.ISessionImporterData[]): boolean {
        const hash: string = toBeExported.length !== 0 ? toBeExported.map(i => i.hash.toString()).join('-') : '-';
        const actual: boolean = this._lastOperationHash !== hash;
        this._lastOperationHash = hash;
        return actual;
    }

    private _onExportTriggered() {
        this.export().catch((error: Error) => {
            this._logger.warn(`Export failed due error: ${error.message}`);
        });
    }

    private _onFileOpenDoneEvent(event: IPCMessages.FileOpenDoneEvent) {
        if (this._session !== event.session) {
            return;
        }
        this.import().catch((error: Error) => {
            this._logger.warn(`Import for "${event.file}" is failed due error: ${error.message}`);
        });
    }

}
