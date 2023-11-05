class ThemeView_addinfo extends ThemeView {
    async init(view) {
        await super.init(view)
        view.find('#ge_save_changes').on('click', async () => {
            //collect info
            const reqs = this.#lastRequestedInfo
            const setted = {
                props: {},
                provider: this.#lastActionProvider
            }
            for (const tabid in reqs.tabs) {
                const tab = reqs.tabs[tabid]
                setted.props[tabid] = {}
                for (const itemname in tab.items) {
                    const thisuid = `${tabid}_${itemname}`
                    const item = tab.items[itemname]
                    let value
                    if (item.type == 'readonly') {
                        value = item.default !== undefined ? item.default : $('#' + thisuid).val()
                    } else if (item.type == 'keyvalue') {
                        value = {}
                        $('#' + thisuid).find('.setting_keyvalue').each(function() {
                            const lab = $(this).find('.label').val().trim()
                            const val = $(this).find('.value').val().trim()
                            if (lab !== undefined && lab.length > 0 && val !== undefined && val.length > 0) {
                                value[lab] = val
                            }
                        })
                    } else if ($('#' + thisuid).is('input[type="checkbox"]')) {
                        if ($('#' + thisuid).is(':checked')) {
                            value = $('#' + thisuid).val()
                        }
                    } else {
                        value = $('#' + thisuid).val()
                    }
                    if (value && ('' + value).trim() == '') {
                        value = undefined
                    }
                    if (value !== undefined) {
                        setted.props[tabid][itemname] = value
                    } else {
                        delete setted.props[tabid][itemname]
                    }
                    if (!value && item.required) {
                        await core.theme.showDialog({
                            title: await core.kernel.translateBlock('${lang.ge_com_required_title}'),
                            body: await core.kernel.translateBlock('${lang.ge_com_required "' + item.label + '"}'),
                            understand: true
                        })
                        $('#tab-btn-' + tabid).click()
                        $('#' + thisuid).focus();
                        return
                    }
                }
            }

            if (this.#lastEditHash) {
                setted.prev_hash = this.#lastEditHash
            }
            let response = await core.kernel.broadcastPluginMethod('gameengine', `confirmGameParams`, setted, {})
            let ret = response.returns.last
            this.log('confirmGameParams response:', response)
            if (!ret.error) {
                ret = (await core.kernel.broadcastPluginMethod('gameengine', this.#lastEditHash ? `updateGame` : `createNewGame`, response.args[0])).returns.last
            }

            if (!ret.error) {
                core.theme.changeView('home')
            } else {
                await core.theme.showDialog({
                    title: ret.error.title,
                    body: ret.error.message,
                    understand: true
                })
                if (ret.tab) {
                    $('#tab-btn-' + ret.tab).click()
                    if (ret.item) {
                        $('#' + `${ret.tab}_${ret.item}`).focus();
                    }
                }
            }
        })
    }
    #lastRequestedInfo
    #lastActionProvider
    #lastEditHash
    async onAppear(args) {
        const _this = this
        await super.onAppear(args)

        const response = await core.kernel.gameList_getImportActions()
        const actions = response.returns.last
        const actioninfo = {}
        actioninfo[args.provider] = actions[args.provider]

        const actionid = Object.keys(actioninfo)[0]
        const action = actioninfo[actionid]

        $('#subtitle').html(action.short)
        $('#goback').attr('onclick', "$('#gd-header [data-view=\"add\"]').click()")

        const rs = await core.kernel.broadcastPluginMethod('gameengine', `queryInfoForGame`, actionid, {})
        const reqs = rs.returns.last
        this.#lastActionProvider = actionid
        this.#lastRequestedInfo = reqs
        this.#lastEditHash = args?.hash

        $('.nav-tabs').empty()
        $('.tab-content').empty()
        this.#storedInfo = {}

        const lastchar = "Z"
        let maxorderlength = 1
        for (const tabid in reqs.tabs) {
            reqs.tabs[tabid].order = reqs.tabs[tabid].order || lastchar
            maxorderlength = Math.max(maxorderlength, reqs.tabs[tabid].order)
        }
        const sorted = []
        for (const tabid in reqs.tabs) {
            const miss = reqs.tabs[tabid].order.length
            reqs.tabs[tabid].order += lastchar.repeat(maxorderlength - reqs.tabs[tabid].order.length)
            sorted.push(tabid)
        }
        //preferredTabsOrder
        sorted.sort((a, b) => {
            if (reqs.tabs[a].order > reqs.tabs[b].order) {
                return 1
            }
            if (reqs.tabs[a].order < reqs.tabs[b].order) {
                return -1
            }
            return 0
        })

        const onchange_itemvalue = function(e) {
            //           console.log("Onchange invoked on ", e)
            let source = undefined
            if (e) {
                const source_cont = $(e.target).closest(`[data-item]`)
                //console.log(source_cont.attr('data-item'))
                source = source_cont.find(`#${source_cont.attr('data-item')}`)
            }

/*            const sourceid = source.attr('data-item')
            console.log(" - Target", source.attr('data-item'))
*/
            Object.entries(reqs.tabs).forEach(([tabid, tab]) => {
                Object.entries(tab.items).forEach(([itemid, item]) => {
                    if (item.when_oneitemvalue_changed) {
                        const fun = `((source)=>{${item.when_oneitemvalue_changed}})`;
                        eval(fun)(source)
                    }
                })
            })
        }


        for (const tabid of sorted) {
            const tab = reqs.tabs[tabid]
            const tabbtn = $(this.getTemplateHtml('tab_btn'))
            tabbtn.find('a').attr('id', 'tab-btn-' + tabid)
                .attr('href', '#tab-pan-' + tabid)
                .attr('aria-controls', 'tab-pan-' + tabid)
                .html(tab.title)
            core.theme.onNewElementAdded(tabbtn)
            $('.nav-tabs').append(tabbtn)
            const panel = $(this.getTemplateHtml('tab_panel'))
            panel.attr('id', 'tab-pan-' + tabid)
                .attr('aria-labelledby', 'tab-btn-' + tabid)


            for (const itemname in tab.items) {
                const item = tab.items[itemname]
                let existingvalue = (args.props && args.props[tabid] && args.props[tabid][itemname] !== undefined) ? args.props[tabid][itemname] : item.default
                const thisuid = `${tabid}_${itemname}`
                const valuecont = $(`<div class="valuecont col-sm-9"></div>`)
                const cont = $(`<div class="form-group row" data-item="${thisuid}"></div>`)

                cont.append($(`<label class="col-sm-3 col-form-label" for="${thisuid}">${item.label}${item.required ? (' <span class="required">*</span>') : ''}</label>`))

                let value
                let browse = false
                if (item.type == 'file') {
                    browse = {
                        icon: 'insert_drive_file',
                        prop: 'openFile'
                    }
                } else if (item.type == 'folder') {
                    browse = {
                        icon: 'folder',
                        prop: 'openDirectory'
                    }
                } else if (item.type == 'text') {
                    value = $(`<input type="text" class="form-control-plaintext value" id="${thisuid}"/>`)
                    valuecont.append(value)
                    value.on('change', onchange_itemvalue);

                    if (existingvalue !== undefined) {
                        value.val(existingvalue)
                    }
                } else if (item.type == 'readonly') {
                    value = $(`<input type="text" class="form-control-plaintext value" id="${thisuid}" disabled/>`)
                    valuecont.append(value)

                    if (existingvalue !== undefined) {
                        value.val(existingvalue)
                    }

                } else if (item.type == 'activable') {
                    const vcont2 = $(`<div class="custom-control custom-switch"></div>`)
                    value = $(`<input type="checkbox" class="custom-control-input" id="${thisuid}">`)
                    vcont2.append(value)
                    vcont2.append(`<label class="custom-control-label" for="${thisuid}">${item.activable_text}</label>`)
                    valuecont.append(vcont2)
                    valuecont.addClass('pt-2')

                    if (existingvalue !== undefined) {
                        if (existingvalue === true) {
                            value.prop("checked", true);
                        } else {
                            value.prop("checked", false);
                        }
                    }

                    value.on('change', onchange_itemvalue);
                } else if (item.type == 'bool') {
                    value = $(`<input type="checkbox" class="form-control-plaintext value" value="1" id="${thisuid}"/>`)
                    valuecont.append(value)

                    if (existingvalue !== undefined) {
                        if (existingvalue == "1" || existingvalue == 1 || existingvalue == true || existingvalue == "true") {
                            value.attr('checked', 'checked')
                        }
                    }

                    value.on('change', onchange_itemvalue);
                } else if (item.type == 'image') {
                    browse = {
                        icon: 'insert_photo',
                        prop: 'openFile'
                    }
                } else if (item.type == 'select') {
                    value = $(`<select class="form-control-plaintext value" id="${thisuid}"></select>`)
                    for (const optval in item.opts) {
                        const opt = item.opts[optval]
                        const optcnt = $(`<option value="${optval}">${opt.title || opt}</option>`)
                        value.append(optcnt)
                        if (existingvalue !== undefined && optval == existingvalue) {
                            optcnt.attr('selected', 'selected')
                        } else if (opt.selected) {
                            optcnt.attr('selected', 'selected')
                        }
                    }
                    value.on('change', onchange_itemvalue);
                    valuecont.append(value)
                } else if (item.type == 'keyvalue') {
                    value = $(this.getTemplateHtml('setting_keyvalue_cont'))
                    value.attr('id', thisuid)
                    existingvalue = existingvalue || {}
                    value.find('.btn-add').on('click', () => {
                        const optcnt = $(this.getTemplateHtml('setting_keyvalue'))
                        optcnt.find('.label').attr('placeholder', item.label_placeholder).val('')
                        optcnt.find('.value').attr('placeholder', item.value_placeholder).val('')
                        value.find('.setting_keyvalue_elems').append(optcnt)
                    })
                    for (const optval in existingvalue) {
                        const optcnt = $(this.getTemplateHtml('setting_keyvalue'))
                        optcnt.find('.label').attr('placeholder', item.label_placeholder).val(optval)
                        optcnt.find('.value').attr('placeholder', item.value_placeholder).val(existingvalue[optval] === undefined ? '' : existingvalue[optval])
                        value.find('.setting_keyvalue_elems').append(optcnt)
                    }
                    valuecont.append(value)
                }

                if (browse) {
                    valuecont.addClass('filebrowser')
                    const browsebtn = $(`<span class="material-icons-outlined btn_browse" title="${await core.kernel.translateBlock('${lang.browse}')}">${browse.icon}</span>`)
                    value = $(`<input type="text" class="form-control-plaintext value" id="${thisuid}"/>`)
                    if (existingvalue !== undefined) {
                        value.val(existingvalue)
                    }
                    browsebtn.on('click', function() {
                        core.kernel.showOpenDialog({
                            properties: [browse.prop]
                            , filters: item.filters
                        }).then(ret => {
                            _this.log(ret)
                            if (!ret.canceled) {
                                value.val(ret.filePaths.length > 0 ? ret.filePaths[0] : '')
                            }
                        })
                    })
                    value.on('change', onchange_itemvalue);
                    valuecont.append(value)
                    valuecont.append(browsebtn)

                }

                if (item.note) {
                    value.on('focus', () => {
                        $('.note').html(item.note)
                    })
                }
                value.on('blur', () => {
                    $('.note').empty()
                })
                cont.append(valuecont)
                panel.append(cont)
            }

            $('.tab-content').append(panel)
            core.theme.onNewElementAdded(panel)
        }

        onchange_itemvalue();
        $('.nav-tabs .nav-link').first().click();

    }
    #storedInfo = {}
}
