'use strict';

import './lib/public-path';

import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import {TranslationRoot, withTranslation} from './lib/i18n';
import account from './account/root';
import login from './login/root';
import blacklist from './blacklist/root';
import lists from './lists/root';
import namespaces from './namespaces/root';
import reports from './reports/root';
import campaigns from './campaigns/root';
import templates from './templates/root';
import users from './users/root';
import sendConfigurations from './send-configurations/root';
import settings from './settings/root';

import {DropdownLink, getLanguageChooser, NavDropdown, NavLink, NavActionLink, Section} from "./lib/page";
import {getNamespaceNameFilterCookie, getNamespaceIdFilterCookie, deleteNamespaceFilterCookies} from "./lib/namespace";
import {
    Form,
    withForm,
    CheckBox, 
    TreeTableSelect
} from './lib/form';

import mailtrainConfig from 'mailtrainConfig';
import Home from "./Home";
import {DropdownActionLink, Icon, ModalDialog} from "./lib/bootstrap-components";
import axios from './lib/axios';
import {withComponentMixins} from "./lib/decorator-helpers";
import PropTypes from 'prop-types';
import {requiresAuthenticatedUser,  withPageHelpers} from './lib/page';
import {withErrorHandling} from './lib/error-handling';
import {getUrl} from "./lib/urls";
import {withAsyncErrorHandler} from './lib/error-handling';

const topLevelMenuKeys = ['lists', 'templates', 'campaigns'];

if (mailtrainConfig.reportsEnabled) {
    topLevelMenuKeys.push('reports');
}


@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
class PreviewNamespaceFilterModalDialog extends Component {
    constructor(props) {
        super(props);
        this.state = {namespaceId: null, namespaceName: this.props.t("namespaceFilter")};
        this.initForm({
            leaveConfirmation: false
        });
    }

    static propTypes = {
        visible: PropTypes.bool.isRequired,
        onHide: PropTypes.func.isRequired,
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        if (!state.getIn(['namespace', 'value']) && state.getIn(['namespace_filter_enabled', 'value'])) {
            state.setIn(['namespace', 'error'], t("namespaceHasToBeSelectedToApply"));
        } else {
            state.setIn(['namespace', 'error'], null);
        }
    }

    componentDidMount() {
        var enabled = false;
        if(getNamespaceIdFilterCookie()){
            enabled = true;
        }
        this.populateFormValues({
            namespace: getNamespaceIdFilterCookie(),
            namespace_filter_enabled: enabled
        });
        this.loadTreeData();
    }

    @withAsyncErrorHandler
    async loadTreeData() {

            const response = await axios.get(getUrl('rest/namespaces-tree'));
            const data = response.data;
            for (const root of data) {
                root.expanded = true;
            }

            if (this.props.entity && !this.isEditGlobal()) {
                this.removeNsIdSubtree(data);
            }

            if (this.isComponentMounted()) {
                this.setState({
                    treeData: data
                });
            }
        
    }

    async setNamespaceFilterAsync() {
        const t = this.props.t;

        if(this.getFormValue('namespace_filter_enabled')){
            if(this.getFormValue('namespace')){
                document.cookie = "namespaceFilterId=" + this.getFormValue('namespace') + "; path=/";
                document.cookie = "namespaceFilterName=" + this.getFormValue('namespace') + "; path=/";
                this.state.namespaceId = this.getFormValue('namespace');
                this.state.namespaceName = this.getFormValue('namespace');
                this.setFormStatusMessage('warning', null);
                this.props.onHide();
            }else{
                this.setFormStatusMessage('warning', t('namespaceMustNotBeEmpty'));
            }
        }else{
            deleteNamespaceFilterCookies();
            this.state.namespaceId = null;
            this.state.namespaceName = "Namespace filter";
            this.setFormStatusMessage('warning', null);
            this.props.onHide();
        }
    }

    async hideModal() {
        this.setFormStatusMessage('warning', null);
        this.props.onHide();
    }

    render() {
        const t = this.props.t;

        return (
            <ModalDialog hidden={!this.props.visible} title={t('namespaceFilter')} onCloseAsync={() => this.hideModal()} buttons={[
                { label: t('apply'), className: 'btn-primary', onClickAsync: ::this.setNamespaceFilterAsync },
                { label: t('close'), className: 'btn-danger', onClickAsync: ::this.hideModal }
            ]}>
                <Form stateOwner={this}>
                    <TreeTableSelect id="namespace" format="wide" label={t('namespace')} data={this.state.treeData}/>
                    <hr/>
                    <CheckBox id="namespace_filter_enabled" format="wide" text={t('enabled')}></CheckBox>
                </Form>
            </ModalDialog>
        );
    }
}

@withComponentMixins([
    withTranslation,
    withForm
])
class Root extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        let structure;

        // The MainMenu component is defined here in order to avoid recreating menu structure on every change in the main menu
        // This is because Root component depends only on the language, thus it is redrawn (and the structure is recomputed) only when the language changes
        @withComponentMixins([
            withTranslation,
            withForm
        ])
        class MainMenu extends Component {
            constructor(props) {
                super(props);
                this.state = {showModal: false};      
            }
            
            async logout() {
                if(mailtrainConfig.namespaceFilterEnabled){
                    deleteNamespaceFilterCookies(); 
                }
                await axios.post(getUrl('rest/logout'));
                window.location = getUrl();
            }

            async showNamespaceFilterModal() {
                this.showModal();
            }

            showModal() { 
                this.setState({
                    showModal: true
                });
            }

            async hideModal() {
                this.hide();
            }

            hide() { 
                this.setState({
                    showModal: false
                });
            }

            render() {
                const path = this.props.location.pathname;

                const topLevelItems = structure.children;

                const topLevelMenu = [];
                
                var namespaceFilter = null;

        
                if(mailtrainConfig.namespaceFilterEnabled){
                    if(getNamespaceNameFilterCookie()){
                        namespaceFilter = <NavActionLink onClickAsync={::this.showNamespaceFilterModal}>{getNamespaceNameFilterCookie()}</NavActionLink>;
                    }else{
                        namespaceFilter = <NavActionLink onClickAsync={::this.showNamespaceFilterModal}>{'Namespace filter'}</NavActionLink>;
                    }
                }
                
                for (const entryKey of topLevelMenuKeys) {
                    const entry = topLevelItems[entryKey];
                    const link = entry.link || entry.externalLink;

                    if (link && path.startsWith(link)) {
                        topLevelMenu.push(<NavLink key={entryKey} className="active" to={link}>{entry.title} <span className="sr-only">{t('current')}</span></NavLink>);
                    } else {
                        topLevelMenu.push(<NavLink key={entryKey} to={link}>{entry.title}</NavLink>);
                    }
                }

                if (mailtrainConfig.isAuthenticated) {
                    return (
                        <>  
                        <PreviewNamespaceFilterModalDialog
                            visible={this.state.showModal}
                            onHide={() => this.setState({showModal: false})}
                        />  
                            <ul className="navbar-nav mt-navbar-nav-left">
                                {topLevelMenu}
                                <NavDropdown label={t('administration')}>
                                    {mailtrainConfig.globalPermissions.displayManageUsers && <DropdownLink to="/users">{t('users')}</DropdownLink>}
                                    <DropdownLink to="/namespaces">{t('namespaces')}</DropdownLink>
                                    {mailtrainConfig.globalPermissions.manageSettings && <DropdownLink to="/settings">{t('globalSettings')}</DropdownLink>}
                                    <DropdownLink to="/send-configurations">{t('sendConfigurations')}</DropdownLink>
                                    {mailtrainConfig.globalPermissions.manageBlacklist && <DropdownLink to="/blacklist">{t('blacklist')}</DropdownLink>}
                                    <DropdownLink to="/account/api">{t('api')}</DropdownLink>
                                </NavDropdown>
                            </ul>
                            <ul className="navbar-nav mt-navbar-nav-right">
                                {namespaceFilter}
                                {getLanguageChooser(t)}
                                <NavDropdown menuClassName="dropdown-menu-right" label={mailtrainConfig.user.username} icon="user">
                                    <DropdownLink to="/account"><Icon icon='user'/> {t('account')}</DropdownLink>
                                    <DropdownActionLink onClickAsync={::this.logout}><Icon icon='sign-out-alt'/> {t('logOut')}</DropdownActionLink>
                                </NavDropdown>        
                            </ul>
                        </>
                    );
                } else {
                    return (
                        <>
                            <ul className="navbar-nav mt-navbar-nav-right">
                                {getLanguageChooser(t)}
                            </ul>
                        </>
                    );
                }
            }
        }

        structure = {
            title: t('home'),
            link: '/',
            panelComponent: Home,
            primaryMenuComponent: MainMenu,
            children: {
                ...login.getMenus(t),
                ...lists.getMenus(t),
                ...reports.getMenus(t),
                ...templates.getMenus(t),
                ...namespaces.getMenus(t),
                ...users.getMenus(t),
                ...blacklist.getMenus(t),
                ...account.getMenus(t),
                ...settings.getMenus(t),
                ...sendConfigurations.getMenus(t),
                ...campaigns.getMenus(t)
            }
        };

        return (
            <Section root='/' structure={structure}/>
        );
    }
}

export default function() {
    ReactDOM.render(<TranslationRoot><Root/></TranslationRoot>,document.getElementById('root'));
};


