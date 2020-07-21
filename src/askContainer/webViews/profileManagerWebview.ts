import * as vscode from 'vscode';
import { AbstractWebView, Utils } from '../../runtime';
import { WebviewPanelOnDidChangeViewStateEvent, ExtensionContext, Uri, Webview } from 'vscode';
import { authenticate } from '../../utils/webViews/authHelper';
import { ViewLoader } from '../../utils/webViews/viewLoader';
import { AskParameterAbsenceError } from '../../exceptions';
import { Logger } from '../../logger';

export const AUTH_FLOW_RESULT = {
    SUCCESS: {
        title: 'All done!',
        message: 'The profile has been linked to your Amazon Developer account and made active in the toolkit. <br/>It can be changed at '
        + 'any time through the status bar selector, and additional profiles may be created through the Profile Manager.'
    },
    VENDOR_ID_ABSENCE: { 
        title: 'Sign in failed.',
        message: `There is no Vendor ID associated with your account.<br/>
        To setup Vendor ID, please follow the instructions here:<br/>
        Every Amazon developer account has a customer ID and one or more vendor IDs.<br/>
        To see them, go to <a href="https://developer.amazon.com/mycid.html">here</a> and sign in with your Amazon developer account.<br/>
        Next, create a new profile or enter the same profile name to reconfigure your Amazon developer account.`
    },
    FAILED: {
        title: 'Sign in failed.',
        message: ''
    }
};

export class ProfileManagerWebview extends AbstractWebView {
    private loader: ViewLoader;

    constructor(viewTitle: string, viewId: string, context: ExtensionContext) {
        super(viewTitle, viewId, context);
        this.loader = new ViewLoader(this.extensionContext, 'profileManager', this);
    }
    
    onViewChangeListener(event: WebviewPanelOnDidChangeViewStateEvent): void {
        Logger.debug(`Calling method: ${this.viewId}.onViewChangeListener`);
        if (event.webviewPanel.visible) {
            this.populateProfilesList();
        }
    }    
    
    onReceiveMessageListener(message: any): void {
        Logger.debug(`Calling method: ${this.viewId}.onReceiveMessageListener, args: `, message);
        if ("profileName" in message) {
            if (!Utils.isNonBlankString(message.profileName)) {
                const errorMessage = "A profile name is required.";
                vscode.window.showErrorMessage(errorMessage);
                this.getPanel().webview.postMessage(
                    {
                        reEnable: true 
                    }
                );
                return;
            }
            this.doAuthenticate(message.profileName);
        } else if("deleteProfile" in message) {
            const currentProfile = Utils.getCachedProfile(this.extensionContext);
            if (currentProfile === message.deleteProfile) {
                const errMsg = 'Cannot delete the currently active profile';
                Logger.error(errMsg);
                vscode.window.showErrorMessage(errMsg);
            } else {
                Utils.deleteProfile(message.deleteProfile);
                this.populateProfilesList();
                const deleteProfileMsg = `Profile ${message.deleteProfile} was deleted`;
                Logger.info(deleteProfileMsg);
                vscode.window.showInformationMessage(deleteProfileMsg);
            }
        }
    }

    getHtmlForView(...args: unknown[]): string {
        Logger.debug(`Calling method: ${this.viewId}.getHtmlForView`);
        return this.loader.renderView({
            name: 'profileManager',
            js: true
        });
    }

    async doAuthenticate(profileName: string): Promise<void> {
        Logger.debug(`Calling method: ${this.viewId}.doAuthenticate, args: `, profileName);
        let viewArgs;
        try {
            await authenticate(this.extensionContext, this, profileName);
            viewArgs = AUTH_FLOW_RESULT.SUCCESS;
        } catch (error) {
            Logger.error(error);
            if (error instanceof AskParameterAbsenceError) {
                viewArgs = AUTH_FLOW_RESULT.VENDOR_ID_ABSENCE;
            } else {
                viewArgs = AUTH_FLOW_RESULT.FAILED;
                viewArgs.message =error instanceof Error ? error.message : error;
            }
        } finally {
            if (!this.isDisposed()) {
                this.getPanel().webview.html =  this.loader.renderView({
                    name: 'authFlowResult',
                    js: true,
                    args: viewArgs
                });
            }
        }
    }

    populateProfilesList(): void {
        Logger.debug(`Calling method: ${this.viewId}.populateProfilesList`);
        const profileNames = Utils.listExistingProfileNames();
        if (profileNames) {
            this.getPanel().webview.postMessage({ profiles: profileNames });
        }
    }

}