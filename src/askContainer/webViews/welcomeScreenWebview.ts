import * as vscode from 'vscode';
import { AbstractWebView } from '../../runtime';
import { ExtensionContext, WebviewPanelOnDidChangeViewStateEvent } from 'vscode';
import { GIT_MESSAGES } from '../../constants';
import { isGitInstalled } from '../../utils/gitHelper';
import { ViewLoader } from '../../utils/webViews/viewLoader';
import { Logger } from '../../logger';
import { EXTENSION_STATE_KEY } from '../../constants';

type welcomeScreenViewType = {
    target?: string;
    showWelcome?: boolean;
    loaded?: boolean;
};

export class WelcomeScreenWebview extends AbstractWebView {
    private loader: ViewLoader;

    constructor(viewTitle: string, viewId: string, context: ExtensionContext) {
        super(viewTitle, viewId, context);
        this.loader = new ViewLoader(this.extensionContext, 'welcomeScreen', this);
    }

    onViewChangeListener(event: WebviewPanelOnDidChangeViewStateEvent): void {
        Logger.debug(`Calling method: ${this.viewId}.onViewChangeListener`);

        const enabled = vscode.workspace.getConfiguration(
            EXTENSION_STATE_KEY.CONFIG_SECTION_NAME).get(
                EXTENSION_STATE_KEY.SHOW_WELCOME_SCREEN);
        this.getWebview()?.postMessage(
            {
                enabled: enabled ? true : false
            }
        );
        return;
    }

    onReceiveMessageListener(message: welcomeScreenViewType): void {
        Logger.debug(`Calling method: ${this.viewId}.onReceiveMessageListener, args: `, message);
        if (message.target === 'createSkill') {
            vscode.commands.executeCommand('ask.new');
        } else if (message.target === 'importSkill') {
            vscode.commands.executeCommand('ask.container.viewAllSkills');
        } else if (message.target === 'profileManager') {
            vscode.commands.executeCommand('ask.init');
        } else if (message.showWelcome !== undefined) {
            vscode.workspace.getConfiguration().update(
                `${EXTENSION_STATE_KEY.CONFIG_SECTION_NAME}.${EXTENSION_STATE_KEY.SHOW_WELCOME_SCREEN}`, 
                message.showWelcome, vscode.ConfigurationTarget.Global);
        }
    }

    getHtmlForView(...args: unknown[]): string {
        Logger.debug(`Calling method: ${this.viewId}.getHtmlForView`);
        const enabled = vscode.workspace.getConfiguration(
            EXTENSION_STATE_KEY.CONFIG_SECTION_NAME).get(
                EXTENSION_STATE_KEY.SHOW_WELCOME_SCREEN);
        this.checkGitInstallation();
        return this.loader.renderView({
            name: 'welcomeScreen',
            js: false,
            args: {
                enabled: enabled ? 'checked' : ''
            }
        });
    }

    private checkGitInstallation() {
        Logger.verbose(`Calling method: checkGitInstallation`);
        if (!isGitInstalled()) {
            vscode.window.showWarningMessage(GIT_MESSAGES.GIT_NOT_FOUND);
        }
    }
}
