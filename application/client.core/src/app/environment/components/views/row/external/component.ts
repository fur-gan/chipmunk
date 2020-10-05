import { Component, Input, AfterContentChecked, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding } from '@angular/core';
import { AOutputRenderComponent, IOutputRenderInputs } from '../../../../interfaces/interface.output.render';
import { IComponentDesc } from 'chipmunk-client-material';
import { EParent } from '../../../../services/standalone/service.output.redirections';
import { Subject } from 'rxjs';
import { ControllerSessionScope } from '../../../../controller/controller.session.tab.scope';
import { EApplyTo } from 'chipmunk.client.toolkit';

import TabsSessionsService from '../../../../services/service.sessions.tabs';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';


@Component({
    selector: 'app-views-output-row-external',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    // encapsulation: ViewEncapsulation.None
})

export class ViewOutputRowExternalComponent extends AOutputRenderComponent implements AfterContentInit, AfterContentChecked, OnDestroy {

    @Input() public str: string | undefined;
    @Input() public sessionId: string | undefined;
    @Input() public position: number | undefined;
    @Input() public pluginId: number | undefined;
    @Input() public source: string | undefined;
    @Input() public component: IComponentDesc | undefined;
    @Input() public scope: ControllerSessionScope | undefined;
    @Input() public parent: EParent;

    public _ng_component: IComponentDesc | undefined;

    private _subjects: {
        update: Subject<{ [key: string]: any }>
    } = {
        update: new Subject<{ [key: string]: any }>()
    };

    constructor(private _cdRef: ChangeDetectorRef ) {
        super();
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngOnDestroy() {
    }

    public ngAfterContentInit() {
        this._setComponent();
    }

    public ngAfterContentChecked() {

    }

    public update(inputs: IOutputRenderInputs): void {
        Object.keys(inputs).forEach((key: string) => {
            (this as any)[key] = inputs[key];
        });
        this._subjects.update.next({
            str: this.str,
            html: this._getHTML(this.str),
        });
    }

    private _setComponent() {
        if (this.pluginId === -1) {
            return;
        }
        if (this.component === undefined) {
            return;
        }
        if (TabsSessionsService.getActive() === undefined) {
            return;
        }
        this._ng_component = {
            factory: this.component.factory,
            resolved: this.component.resolved,
            inputs: Object.assign({}, this.component.inputs)
        };
        // Define inputs for custom render
        this._ng_component.inputs = Object.assign(this._ng_component.inputs, {
            str: this.str,
            html: this._getHTML(this.str),
            api: TabsSessionsService.getPluginAPI(this.pluginId),
            update: this._subjects.update
        });
        this._cdRef.markForCheck();
    }

    private _getHTML(str: string): string {
        // Apply search matches parser
        const highlight = OutputParsersService.highlight(this.sessionId, str);
        // Rid of HTML
        str = OutputParsersService.serialize(str);
        // Set colors
        this.color = highlight.color;
        this.background = highlight.background;
        // Apply plugin parser
        str = OutputParsersService.row({
            str: str,
            pluginId: this.pluginId,
            source: this.source,
            position: this.position,
            hasOwnStyles: (highlight.color !== undefined) || (highlight.background !== undefined),
        }, this.parent);
        // Return parsed HTML
        return str;
    }

}
