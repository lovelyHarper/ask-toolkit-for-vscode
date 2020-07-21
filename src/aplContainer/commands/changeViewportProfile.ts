/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 */
import * as vscode from 'vscode';
import { OrderedMap } from 'immutable';
import { AbstractCommand } from '../../runtime';
import { getViewportProfiles, IViewportProfile, IViewport } from 'apl-suggester';
import { EXTENSION_COMMAND_CONFIG } from '../config/configuration';
import {
    getViewportCharacteristicsFromViewPort
} from '../utils/viewportProfileHelper';
import { AplPreviewWebView } from '../webViews/aplPreviewWebView';
import { ERROR_MESSAGES } from '../constants/messages';
import { loggableAskError } from '../../exceptions';
import { Logger } from '../../logger';

export class ChangeViewportProfileCommand extends AbstractCommand<void> {
    private viewportProfiles!: OrderedMap<string, IViewportProfile>;
    private aplPreviewWebView: AplPreviewWebView;

    constructor(webView: AplPreviewWebView) {
        super(EXTENSION_COMMAND_CONFIG.CHANGE_VIEWPORT_PROFILE.NAME);
        this.aplPreviewWebView = webView;
    }

    public async execute(): Promise<void> {
        Logger.debug(`Calling method: ${this.commandName}`);
        this.viewportProfiles = OrderedMap<string, IViewportProfile>(getViewportProfiles());
      
        try {
            const aplPreviewPanel: vscode.WebviewPanel = this.aplPreviewWebView.getPanel();
            // change viewport profile before preview, no panel 
            if (!aplPreviewPanel || !aplPreviewPanel.visible) {
                throw loggableAskError(ERROR_MESSAGES.CHANGE_VIEWPORT_PROFILE_NO_APL_PREVIEW, undefined, true);
            }
        } catch(err) {
            // panel is disposed
            throw loggableAskError(ERROR_MESSAGES.CHANGE_VIEWPORT_PROFILE_NO_APL_PREVIEW, undefined, true);

        }

        const pickedViewportProfile: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(
            this.getViewportProfileOptions()
        );
        if (!pickedViewportProfile) {
            return;
        }

        const pickedViewport: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(
            this.getViewportOptions(pickedViewportProfile.label)
        );
        if (!pickedViewport) {
            return;
        }
        this.changeViewport(pickedViewport.label);
    }

    /**
     * Function to generate viewport profile options
     *
     * @private
     * @returns {vscode.QuickPickItem[]}
     *
     * @memberOf ChangeViewportProfile
     */
    private getViewportProfileOptions(): vscode.QuickPickItem[] {
        return this.viewportProfiles
            .map(
                v =>
                    ({
                        label: v.name,
                        description: `See ${v.exampleDevices.length} viewport profiles`,
                    } as vscode.QuickPickItem)
            )
            .valueSeq()
            .toArray();
    }

    /**
     * Function to generate viewport options for each viewport profile
     *
     * @private
     * @param {string} viewportProfileName - the name of viewport profile shown in VSCode QuickPickItem
     * @returns {vscode.QuickPickItem[]}
     *
     * @memberOf ChangeViewportProfile
     */
    private getViewportOptions(pickedViewportProfileName: string): vscode.QuickPickItem[] {
        const viewportProfile: IViewportProfile | undefined = this.viewportProfiles.find(
            v => v.name === pickedViewportProfileName
        );
        if (viewportProfile) {
            return viewportProfile.exampleDevices
                .map(
                    (viewport: IViewport) =>
                        ({
                            label: viewport.name,
                            description: `Change to ${viewport.name}`,
                        } as vscode.QuickPickItem)
                )
                .reduce((prev: vscode.QuickPickItem[], item: vscode.QuickPickItem) => prev.concat(item), []);
        }
        return [];
    }

    /**
     * Function to change viewport for APL renderer web view
     *
     * @private
     * @param {string} pickedViewportName - the name of the viewport shown in VSCode QuickPickItem
     *
     * @memberOf ChangeViewportProfile
     */
    private async changeViewport(pickedViewportName: string): Promise<void> {
        const viewportProfileToChange = this.viewportProfiles.find((v: IViewportProfile) =>
            this.findToChangeViewport(v, pickedViewportName)
        );
        if (!viewportProfileToChange) {
            throw loggableAskError(ERROR_MESSAGES.CHANGE_VIEWPORT_PROFILE_NO_MATCHED_VIEWPORT, new Error(`No viewport profile found for ${pickedViewportName}`), true);
        }
    }

    /**
     * Function to find matched viewport and change to it
     *
     * @private
     * @param {ViewportProfile} viewportProfile - the viewport profile to look up
     * @param {string} pickedViewportName - the name of the viewport shown in VSCode QuickPickItem
     * @returns {boolean}
     *
     * @memberOf ChangeViewportProfile
     */
    private findToChangeViewport(viewportProfile: IViewportProfile, pickedViewportName: string): boolean {
        const viewportToChange: IViewport | undefined = viewportProfile.exampleDevices.find(
            v => v.name === pickedViewportName
        );
        if (viewportToChange) {
            const viewport = getViewportCharacteristicsFromViewPort({
                ...viewportToChange,
                shape: viewportProfile.shape,
            } as IViewport);
            this.aplPreviewWebView.changeViewport(viewport);
            return true;
        }
        return false;
    }
}
