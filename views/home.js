﻿class ThemeView_home extends ThemeView {
    #gameListLastModifiedTime
    async init(w) {
        await super.init(w)
        if (!$('html').attr('data-gamelist-style')) {
            $('html').attr('data-gamelist-style', 'block')
        }

        $(document).on('kernel.onGameStatusChanged', async (ev, args) => {
            this.log('Received kernel.onGameStatusChanged', args)
            const dialog = $(`[data-game-hash="${args}"]`)
            const card = $(`.gameitem[data-hash="${args}"]`)
            if (await core.kernel.gameList_isGameStartedByHash(args)) {
                dialog.addClass('game-running')
                dialog.find(`.col-buttons .game-terminating`).removeClass('game-terminating')
                card.addClass(`started`)
            } else {
                dialog.removeClass('game-running')
                dialog.find(`.col-buttons .game-starting`).removeClass('game-starting')
                card.removeClass(`started`)
            }
        })
    }
    async onAppear(args) {
        await super.onAppear(args)
        if (await core.kernel.gameList_getGamesCount() == 0) {
            $('#nogameinlist').show();
            $('#gamegrid').hide();
        } else {
            $('#nogameinlist').hide();
            $('#gamegrid').show();
            await this.showList()
        }
    }
    async showList() {
        const lastMod = await core.kernel.gameList_getLastModifiedTimeStamp()

        if (this.#gameListLastModifiedTime == lastMod) {
            return
        }
        this.#gameListLastModifiedTime = lastMod
        const games = await core.kernel.gameList_getGamesFiltered(undefined, true)

        games.sort((a, b) => {
            if (a.props.info.title?.toLowerCase() < b.props.info.title?.toLowerCase()) {
                return -1
            }
            if (a.props.info.title?.toLowerCase() > b.props.info.title?.toLowerCase()) {
                return 1
            }
            return 0
        })

        $('#gamegrid .gameitem').remove()
        for (const gameinfo of games) {
            //for (let h = 0; h < 100; h++) {
            await this.updateGameCard(gameinfo)
        }
    }
    async gameUpdated(hash, oldhash) {
        const gameinfo = await core.kernel.gamelist_getGameByHash(hash, true)
        this.updateGameCard(gameinfo, oldhash)
        //if selectdialog is open, close it!
        $(`.modal[data-game-hash="${oldhash}"]`).modal('hide')
    }
    async updateGameCard(gameinfo, oldhash) {
        const hash = oldhash || gameinfo.hash
        let cnt = $(`[data-hash="${oldhash}"].gameitem`)

        const newone = (cnt.length == 0)
        if (newone) {
            cnt = $(await core.theme.translateBlock(this.getTemplateHtml('gamelist_item')))
        }
        const game = gameinfo.props

        cnt.attr('data-hash', gameinfo.hash)
        cnt.find('.title').text(game.info.title)
        cnt.find('.year').text(game.info.year)

        if (game.info.icon) {
            cnt.find('.icon').css('background-image', `url('${game.info.icon}')`)
        }

        const imagelandscape = game.info.imagelandscape ? await core.kernel.getUrlbyGameHash(hash, game.info.imagelandscape) : undefined
        const imageportrait = game.info.imageportrait ? await core.kernel.getUrlbyGameHash(hash, game.info.imageportrait) : undefined

        if (imagelandscape) {
            cnt.find('.imagelandscape').css('background-image', `url('${imagelandscape}}')`).removeClass('wasportrait')
        } else if (imageportrait) {
            cnt.find('.imagelandscape').css('background-image', `url('${imageportrait}}')`).addClass('wasportrait')
        }
        if (imageportrait) {
            cnt.find('.imageportrait').css('background-image', `url('${imageportrait}}')`).removeClass('waslandscape')
        } else if (imagelandscape) {
            cnt.find('.imageportrait')
                .css('background-image', `url('${imagelandscape}}')`)
                .addClass('waslandscape')
        }
        if (game.info.tags) {
            for (const tag of game.info.tags) {
                const tcnt = $(this.getTemplateHtml('gamelist_item_tag'))
                tcnt.find('.text').text(tag.name)
                tcnt.css('color', tag.color)
                cnt.find('.tags').append(tcnt)
            }
        }
        core.theme.onNewElementAdded(cnt)
        if (newone) {
            $(cnt).on('click', () => {
                if (!$(cnt).is('.active')) {
                    $('.gameitem').removeClass('active')
                    cnt.addClass('active')
                    return
                }
                if (cnt.is('.started')) {
                    this.openDialogGame(gameinfo.hash)
                } else {
                    this.startGameByHash(gameinfo.hash)
                }
            })
            $(cnt).on('contextmenu', () => {
                this.openDialogGame(gameinfo.hash)
            })
            $('#gamegrid #gamegrid_centerer').append(cnt)
        }


        //}    
    }
    async openDialogGame(hash) {
        const gameinfo = await core.kernel.gamelist_getGameByHash(hash, true)
        //this.log(gameinfo)

        const body = $(this.getTemplateHtml('game_dialog'))
        const game = gameinfo.props
        const imagelandscape = game.info.imagelandscape ? await core.kernel.getUrlbyGameHash(hash, game.info.imagelandscape) : undefined
        const imageportrait = game.info.imageportrait ? await core.kernel.getUrlbyGameHash(hash, game.info.imageportrait) : undefined

        if (imagelandscape || imageportrait) {
            body.find('.col-info').css('background-image', `url('${imagelandscape || imageportrait}')`)
        }

        const gameisstarted = await core.kernel.gameList_isGameStartedByHash(hash)

        const otherbuttons = (await core.kernel.broadcastPluginMethod([], `queryButtonforGameDetails`, hash, {})).returns.last

        for (const btnname in otherbuttons) {
            const butinfo = otherbuttons[btnname]
            let iconbutton
            if (butinfo.icon.indexOf('mi:') == 0) {
                iconbutton = $(this.getTemplateHtml('game_dialog_button'))
                iconbutton.attr('data-btn', btnname).text(butinfo.icon.substr(3))
                    .attr('title', butinfo.title)
                iconbutton.on('click', () => {
                    core.kernel.broadcastPluginMethod(butinfo.provider, 'onButtonClick',
                        {
                            ...butinfo, ...{ id: btnname, actions: otherbuttons }
                        }, hash)
                })
                body.find('.col-buttons').append(iconbutton)
            } else {
                throw new Error(`TODO: queryButtonforGameDetails button.icon!="mi:*" not implemented yet`)
            }

        }

        if (!(await core.kernel.gameList_isGameEditableByHash(hash))) {
            body.find('.btn-edit').hide()
        } else {
            body.find('.btn-edit').on('click', async () => {
                core.theme.changeView('addinfo', gameinfo)
            })
        }

        body.find('.btn-delete').on('click', async () => {
            const uninstalldlg = $(this.getTemplateHtml('game_uninstall_dialog'))
            await core.theme.showDialog({
                title: (await core.kernel.translateBlock('${lang.dialog_game_uninstall}')) + gameinfo.props.info.title
                , body: uninstalldlg
                , onPreShow: async (modal) => {

                    //this.log(gameinfo)
                    const ret = (await core.kernel.broadcastPluginMethod('gameengine', 'querySwitchForUninstall', hash)).returns.all
                    for (const provider in ret) {
                        for (const swc in ret[provider].switches) {
                            const btn = $(`<div class="col-12 dg_uni_btn" data-prov-id="${provider}" data-swc-id="${swc}">
                                <div class="custom-control custom-switch">
                                    <input class="custom-control-input" type="checkbox" value="" id="${swc}">
                                    <label class="custom-control-label" for="${swc}">
                                        ${ret[provider].switches[swc].label}
                                    </label>
                                </div>
                            </div>`)
                            modal.find('.game_uninstall_dialog').append(btn)
                        }
                    }

                    const html = '<button type="button" class="btn btn-danger btn-proceed" data-dismiss="modal">${lang.dialog_proceed}</button>'
                        + '<button type="button" class="btn btn-secondary" data-dismiss="modal">${lang.dialog_abort}</button>'

                    //modal.find('.modal-body #gu_rmrf_cmd_path').text()
                    modal.find('.modal-footer').html(await core.kernel.translateBlock(html));

                    modal.find('.modal-footer .btn-proceed').on('click', () => {
                        const toexec = []
                        modal.find('.game_uninstall_dialog').parent().find('.dg_uni_btn').each(function() {
                            const prov = $(this).attr('data-prov-id')
                            const swc = $(this).attr('data-swc-id')
                            if (prov && swc && $(this).find('input').is(':checked')) {
                                toexec.push({
                                    prov: prov
                                    , swc: swc
                                })
                            }
                        })



                        return new Promise(async (resolve) => {
                            try {
                                core.kernel.sendEvent('showProgress', await core.kernel.translateBlock('${lang.game_dialog_uninstall_inprogress}'))
                                core.kernel.sendEvent('allowHideProgress', false)
                                for (const obj of toexec) {
                                    this.log('executeUninstallOf', obj)
                                    await core.kernel.broadcastPluginMethod('gameengine', 'executeUninstallOf', hash, obj.swc, obj.prov)
                                }
                                await core.kernel.gameList_removeGame(hash)
                                $(`#gamegrid .gameitem[data-hash="${hash}"]`).fadeOut(function() {
                                    $(`#gamegrid .gameitem[data-hash="${hash}"]`).remove()
                                })
                            } finally {
                                core.kernel.sendEvent('allowHideProgress', true)
                                core.kernel.sendEvent('hideProgress')
                            }
                        })
                    })

                    $(modal).attr('data-game-hash', gameinfo.hash)
                }
            })
        })

        body.find('.btn-stop').on('click', async () => {
            body.find('.btn-stop').addClass('game-terminating')
            await core.kernel.forceCloseGameByHash(hash)
        })

        body.find('.btn-start').on('click', async (e) => {
            this.startGameByHash(hash)
            e.preventDefault()
            return false
        })

        //body.find('.col-info').

        await core.theme.showDialog({
            title: gameinfo.props.info.title
            , body: body
            , onPreShow: (modal) => {
                $(modal).attr('data-game-hash', gameinfo.hash)
                $(modal).find(`.col-buttons .game-terminating`).removeClass('game-terminating')
                $(modal).find(`.col-buttons .game-starting`).removeClass('game-starting')
                if (gameisstarted) {
                    $(modal).addClass('game-running')
                } else {
                    $(modal).removeClass('game-running')
                }
            }
        })
    }
    async startGameByHash(hash) {
        const gameisstarted = await core.kernel.gameList_isGameStartedByHash(hash)
        if (gameisstarted) {
            return
        }

        const body = $(`.modal[data-game-hash="${hash}"]`)
        body.find('.btn-start').addClass('game-starting')
        const ret = (await core.kernel.startGameByHash(hash)).returns?.last
        //
        //this.log(ret)
        if (ret.error) {
            body.find('.btn-start').removeClass('game-starting')
            await core.theme.showDialog({
                title: ret.error.title,
                body: ret.error.message + '<p class="game-error text-danger">' + ret.exit.log + '</p>',
                understand: true
            })
        }
    }
}
