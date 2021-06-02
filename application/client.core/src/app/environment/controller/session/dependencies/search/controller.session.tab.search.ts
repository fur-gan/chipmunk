import { ControllerSessionTabSearchFilters, FilterRequest } from './dependencies/filters/controller.session.tab.search.filters';
import { ControllerSessionTabSearchCharts } from './dependencies/charts/controller.session.tab.search.charts';
import { ControllerSessionTabSearchRanges } from './dependencies/timeranges/controller.session.tab.search.ranges';
import { ControllerSessionTabSearchDisabled } from './dependencies/disabled/controller.session.tab.search.disabled';
import { ControllerSessionTabSearchOutput } from './dependencies/output/controller.session.tab.search.output';
import { ControllerSessionTabSearchStore } from './dependencies/store/controller.session.tab.search.store';
import { ControllerSessionTabSearchQueue } from './dependencies/state/controller.session.tab.search.state';
import { Provider } from '../../../../components/sidebar/search.manager/providers/provider';
import { Dependency, SessionGetter } from '../session.dependency';

import { Subject, Observable } from 'rxjs';

import * as Toolkit from 'chipmunk.client.toolkit';
import { SearchDependencyConstructor } from './dependencies/search.dependency';

export class ControllerSessionTabSearch implements Dependency {

    private _logger: Toolkit.Logger;
    private _subjects: {
        search: Subject<FilterRequest>,
    } = {
        search: new Subject<FilterRequest>(),
    };
    private _guid: string;
    private _dependencies: {
        charts: ControllerSessionTabSearchCharts | undefined,
        filters: ControllerSessionTabSearchFilters | undefined,
        ranges: ControllerSessionTabSearchRanges | undefined,
        disabled: ControllerSessionTabSearchDisabled | undefined,
        output: ControllerSessionTabSearchOutput | undefined,
        queue: ControllerSessionTabSearchQueue | undefined,
        store: ControllerSessionTabSearchStore | undefined,
    } = {
        charts: undefined,
        filters: undefined,
        ranges: undefined,
        disabled: undefined,
        output: undefined,
        queue: undefined,
        store: undefined,
    };
    private _session: SessionGetter;
    private _selected: Provider<any> | undefined;

    constructor(uuid: string, getter: SessionGetter) {
        this._guid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            function factory<T>(self: ControllerSessionTabSearch, Dep: SearchDependencyConstructor<T>): Dependency & T {
                return new Dep(self._guid, self._session, () => self);
            }
            function init<T>(self: ControllerSessionTabSearch, dependency: Dependency & T): Promise<void> {
                return new Promise((res, rej) => {
                    self._logger.debug(
                        `Initing ${dependency.getName()} for session ${self._guid}`,
                    );
                    dependency
                        .init()
                        .then(() => {
                            self._logger.debug(`${dependency.getName()} inited successfully`);
                            res();
                        })
                        .catch((err: Error) => {
                            rej(
                                new Error(
                                    self._logger.error(
                                        `Fail to init ${dependency.getName()} due error: ${
                                            err.message
                                        }`,
                                    ),
                                ),
                            );
                        });
                });
            }
            this._dependencies.charts = factory<ControllerSessionTabSearchCharts>(
                this,
                ControllerSessionTabSearchCharts,
            );
            this._dependencies.filters = factory<ControllerSessionTabSearchFilters>(
                this,
                ControllerSessionTabSearchFilters,
            );
            this._dependencies.ranges = factory<ControllerSessionTabSearchRanges>(
                this,
                ControllerSessionTabSearchRanges,
            );
            this._dependencies.disabled = factory<ControllerSessionTabSearchDisabled>(
                this,
                ControllerSessionTabSearchDisabled,
            );
            this._dependencies.output = factory<ControllerSessionTabSearchOutput>(
                this,
                ControllerSessionTabSearchOutput,
            );
            this._dependencies.queue = factory<ControllerSessionTabSearchQueue>(
                this,
                ControllerSessionTabSearchQueue,
            );
            this._dependencies.store = factory<ControllerSessionTabSearchStore>(
                this,
                ControllerSessionTabSearchStore,
            );
            Promise.all([
                init<ControllerSessionTabSearchCharts>(this, this._dependencies.charts),
                init<ControllerSessionTabSearchFilters>(this, this._dependencies.filters ),
                init<ControllerSessionTabSearchRanges>(this, this._dependencies.ranges ),
                init<ControllerSessionTabSearchDisabled>(this, this._dependencies.disabled ),
                init<ControllerSessionTabSearchOutput>(this, this._dependencies.output ),
                init<ControllerSessionTabSearchQueue>(this, this._dependencies.queue ),
                init<ControllerSessionTabSearchStore>(this, this._dependencies.store ),
            ])
                .then(() => {
                    this._logger.debug(`Session search"${this._guid}" is created`);
                    resolve();
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(Object.keys(this._dependencies).map((key: string) => {
                const dep = this._dependencies[key];
                return dep.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail normaly destroy dependency "${dep.getName()}" due error: ${err.message}`);
                });
            })).then(() => {
                resolve();
            });
        });
    }

    public getName(): string {
        return 'ControllerSessionTabSearch';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        search: Observable<FilterRequest>,
    } {
        return {
            search: this._subjects.search.asObservable(),
        };
    }

    public getQueue(): ControllerSessionTabSearchQueue {
        return this._dependencies.queue;
    }

    public getOutputStream(): ControllerSessionTabSearchOutput {
        return this._dependencies.output;
    }

    public getFiltersAPI(): ControllerSessionTabSearchFilters {
        return this._dependencies.filters;
    }

    public getChartsAPI(): ControllerSessionTabSearchCharts {
        return this._dependencies.charts;
    }

    public getRangesAPI(): ControllerSessionTabSearchRanges {
        return this._dependencies.ranges;
    }

    public getDisabledAPI(): ControllerSessionTabSearchDisabled {
        return this._dependencies.disabled;
    }

    public getStoreAPI(): ControllerSessionTabSearchStore {
        return this._dependencies.store;
    }

    public search(request: FilterRequest) {
        this._subjects.search.next(request);
    }

    public get selected(): Provider<any> | undefined {
        return this._selected;
    }

    public set selected(provider: Provider<any> | undefined) {
        this._selected = provider;
    }

}
