﻿class ThemeView_add extends ThemeView {
    async init(view) {
        await super.init(view)
        const actions = (await core.kernel.gameList_getImportActions()).returns.last
        for (const actionid in actions) {
            const action = actions[actionid]
            const provider = action.provider
            const cnt = $(this.getTemplateHtml('import_action'))
            cnt.html(action.button)
            //cnt.attr('data-provider', provider)
            //cnt.attr('data-action', actionid)
            cnt.on('click', () => {
                if (!action.immediate) {
                    core.theme.changeView('addinfo', {
                        provider: actionid
                    })
                } else {
                    this.#lastImportAction = {
                        provider: provider,
                        action: actionid
                    }
                    core.kernel.broadcastPluginMethod(provider, 'onButtonClick', {
                        ...action, ...{ id: actionid, actions: actions }
                    })
                }
            })
            view.find('#importmethods_tbox').append(cnt)
            await core.theme.onNewElementAdded(cnt)

        }
    }
    #lastImportAction
    async pluginMethodExecuted(args) {
        if (args.method == 'onButtonClick' && this.#lastImportAction?.provider == args.provider && this.#lastImportAction?.action == args.action) {
            core.theme.changeView('home')
        }
    }
}
