/*
Concerto Platform - Online Adaptive Testing Platform
Copyright (C) 2011-2012, The Psychometrics Centre, Cambridge University

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; version 2
of the License, and not any of the later versions.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

function Concerto(container,hash,sid,tid,queryPath,callbackGet,callbackSend,debug,remote,loadingImageSource,resumeFromLastTemplate){
    this.resumeFromLastTemplate = false;
    if(resumeFromLastTemplate!=null) this.resumeFromLastTemplate = resumeFromLastTemplate;
    this.loadingImageSource = 'css/img/ajax-loader.gif';
    if(loadingImageSource!=null) this.loadingImageSource = loadingImageSource;
    this.remote = false;
    if(remote!=null) this.remote = remote;
    this.isDebug = false;
    if(debug!=null && debug==true) this.isDebug = true;
    this.container = container;
    this.sessionID = sid;
    this.hash = hash;
    this.testID = tid;
    this.queryPath = queryPath==null?"query/":queryPath;
    this.callbackGet = callbackGet;
    this.callbackSend = callbackSend;
    this.isStopped = false;
    
    this.data = null;
    this.debug = null;
    this.status = Concerto.statusTypes.created;
    this.finished = false;
    
    this.timer = 0;
    this.timeObj = null;
    
    this.timeTemplateLoaded = null;
    
    this.clearTimer=function(){
        if(this.timeObj!=null) {
            clearTimeout(this.timeObj);
        }
    }
    this.iniTimer = function(){
        var thisClass=this;
        var limit = this.data["TIME_LIMIT"];
        this.timeTemplateLoaded = new Date();
        
        if(limit>0){
            this.timer = limit;
            $(".fontTimeLeft").html(this.timer);
            this.timeObj = setInterval(function(){
                thisClass.timeTick();
            },1000);
        }
    }
    
    this.timeTick = function(){
        if(this.isStopped) return;
        if(this.timer>0){
            this.timer--;
            $(".fontTimeLeft").html(this.timer);
            if(this.timer==0){
                this.submit("NONE");
            }
        }
    }
    
    this.stop=function(){
        this.clearTimer();
        this.isStopped = true;
    }
    
    this.run=function(btnName,values){
        if(this.isStopped) return;
        this.status = Concerto.statusTypes.working;
        ConcertoMethods.loading(this.container,this.loadingImageSource);
        var thisClass = this;
        
        var params = {};
        params["resume_from_last_template"] = this.resumeFromLastTemplate?"1":"0";
        this.resumeFromLastTemplate = false;
        if(this.hash!=null && this.sessionID!=null) 
        {
            params["hash"] = this.hash;
            params["sid"] = this.sessionID;
            if(!this.remote && !this.isDebug) Concerto.saveSessionCookie(this.sessionID,this.hash);
        }
        else
        {
            if(this.testID!=null) params["tid"] = this.testID;
        }
        if(btnName!=null) params["btn_name"] = btnName;
        if(values!=null) params["values"] = values;
        if(this.isDebug!=null && this.isDebug==true) params["debug"]=1;
        else params["debug"]=0;
        
        var date = new Date();
        $.post((this.remote?this.queryPath:this.queryPath+"r_call.php")+"?timestamp="+date.getTime(),
            params,
            function(data){
                thisClass.data = data.data;
                if(data.debug){
                    thisClass.debug = data.debug;
                }
                
                thisClass.hash = thisClass.data["HASH"];
                thisClass.sessionID = thisClass.data["TEST_SESSION_ID"];
                thisClass.testID = thisClass.data["TEST_ID"];
                thisClass.status = thisClass.data["STATUS"];
                thisClass.finished = thisClass.data["FINISHED"]==1;
                
                if(thisClass.data["STATUS"]==Concerto.statusTypes.template) thisClass.loadTemplate(thisClass.data["HTML"],thisClass.data["HEAD"]);
                if(thisClass.data["STATUS"]==Concerto.statusTypes.completed) $(thisClass.container).html("");
                if(thisClass.data["STATUS"]==Concerto.statusTypes.tampered) $(thisClass.container).html("<h2>Session unavailable.</h2>");
                
                if(thisClass.finished && !thisClass.remote && !thisClass.isDebug) Concerto.removeSessionCookie(thisClass.sessionID, thisClass.hash);
                
                if(thisClass.data["STATUS"]==Concerto.statusTypes.error){
                    if(thisClass.debug==null){
                        $(thisClass.container).html("<h2>Fatal test exception encountered. Test halted.</h2>");
                    }
                    else {
                        $(thisClass.container).html("<h2>R return code</h2>");
                        $(thisClass.container).append(thisClass.debug["return"]);
                        $(thisClass.container).append("<hr/>");
                        $(thisClass.container).append("<h2>R code</h2>");
                        $(thisClass.container).append(thisClass.debug["code"].replace(/\n/g,'<br />'));
                        $(thisClass.container).append("<hr/>");
                        $(thisClass.container).append("<h2>R output</h2>");
                        for(var i=0; i<thisClass.debug["output"].length;i++){
                            if(thisClass.debug["output"][i]==null) continue;
                            $(thisClass.container).append(thisClass.debug["output"][i].replace(/\n/g,'<br />')+"<br/>");
                        }
                    }
                }
                if(thisClass.callbackGet!=null) thisClass.callbackGet.call(thisClass, data);
                return thisClass.data;
            },"json");
        return null;
    };
    
    this.insertSpecialVariables=function(html){
        html = html.replace("{{TIME_LEFT}}","<font class='fontTimeLeft'></font>");
        return html;
    };
    
    this.loadTemplate=function(html,head){
        var thisClass = this;
        $("head").append(head);
        $(thisClass.container).html(thisClass.insertSpecialVariables(html));
        thisClass.addSubmitEvents();
        thisClass.iniTimer();
    };
    
    this.getControlsValues=function(){
        var values = new Array();
        
        $(this.container).find("input:text, input:hidden, input:password, textarea, select, input:checkbox:checked, input:radio:checked").each(function(){
            var name = $(this).attr("name");
            var value = $(this).val();
            var found = false;
            for(var i=0;i<values.length;i++){
                if(values[i].name == name){
                    found = true;
                    if(values[i].value instanceof Array) values[i].value.push(value);
                    else values[i].value = [values[i].value,value];
                }
            }
            if(!found) {
                var obj = {
                    name:name,
                    value:value
                };
                values.push(obj);
            }
        });
        
        for(var i=0;i<values.length;i++){
            values[i] = $.toJSON(values[i]);
        }
        
        return values;
    }
    
    this.submit=function(btnName){
        var currentTime = new Date();
        var thisClass=this;
        this.clearTimer();
        if(this.isStopped) return;
        var vals = this.getControlsValues();
        vals.push($.toJSON({
            name:"TIME_TAKEN",
            value:(currentTime.getTime()-thisClass.timeTemplateLoaded.getTime())/1000
        }));
        this.run(btnName,vals);
        if(this.callbackSend!=null) this.callbackSend.call(this,btnName,vals);
    };
    
    this.addSubmitEvents=function(){
        var thisClass = this;
        
        $(container).find(":button:not(.notInteractive)").click(function(){
            thisClass.submit($(this).attr("name"));
        });
        $(container).find("input:image:not(.notInteractive)").click(function(){
            thisClass.submit($(this).attr("name"));
        });
        $(container).find("input:submit:not(.notInteractive)").click(function(){
            thisClass.submit($(this).attr("name"));
        });
    }
};

Concerto.statusTypes={
    created:0,
    working:1,
    template:2,
    completed:3,
    error:4,
    tampered:5
};

Concerto.toggleSessionLauncher=function(){
    $(".tdSessionLauncher").toggle(500);
}

Concerto.getSessionCookie=function(){
    var session = $.cookie('concerto_test_sessions');
    if(session==null) return [];
    else return $.evalJSON(session);
}

Concerto.resetSessionCookie = function(){
    $.cookie('concerto_test_sessions',$.toJSON([]),{
        expires:1,
        path:"/"
    });
}

Concerto.fillSessionSelection = function(session){
    if(session==null){
        session = Concerto.getSessionCookie();
    }
    $("#selectOpenedSessions").html("<option value='0'>&lt;none selected&gt;</option>");
    for(var i=0;i<session.length;i++){
        var index = i+1;
        var elem = session[i];
        $("#selectOpenedSessions").append("<option value='"+index+"' sid='"+elem.sid+"' hash='"+elem.hash+"'>#"+elem.sid+": "+elem.date+"</option>");
    }
}

Concerto.saveSessionCookie=function(sid,hash){
    var session = Concerto.getSessionCookie();
    var date = new Date();
    var exists = false;
    for(var i=0;i<session.length;i++){
        var elem = session[i];
        if(elem.sid == sid && elem.hash == hash){
            exists = true;
            session[i].date = date.toUTCString();
        }
    }
    if(!exists){
        session.push({
            sid:sid,
            hash:hash,
            date:date.toUTCString()
        });
    }
    $.cookie('concerto_test_sessions',$.toJSON(session),{
        expires:1,
        path:"/"
    });
    Concerto.fillSessionSelection(session);
}

Concerto.removeSessionCookie=function(sid,hash){
    var session = Concerto.getSessionCookie();
    var result = [];
    for(var i=0;i<session.length;i++){
        var elem = session[i];
        if(elem.sid != sid && elem.hash != hash){
            result.push(elem);
        }
    }
    $.cookie('concerto_test_sessions',$.toJSON(result),{
        expires:1,
        path:"/"
    });
    Concerto.fillSessionSelection(result);
}

Concerto.selectTest=function(){
    var select = $("#selectTest");
    var tid = select.val();
    if(typeof test != 'undefined' && test!=null){
        test.stop();
        test = new Concerto(test.container,null,null,tid,test.queryPath,test.callbackGet,test.callbackSend,test.debug,test.remote,test.loadingImageSource,test.resumeFromLastTemplate);
    }
    test = new Concerto($("#divTestContainer"),null,null,tid);
    test.run(null,[]);
    select.val(0);
    Concerto.toggleSessionLauncher();
}

Concerto.selectSession=function(){
    var select = $("#selectOpenedSessions");
    var sid = select.children("option[value='"+select.val()+"']").attr('sid');
    var hash = select.children("option[value='"+select.val()+"']").attr('hash');
    if(typeof test != 'undefined' && test!=null){
        test.stop();
        test = new Concerto(test.container,hash,sid,null,test.queryPath,test.callbackGet,test.callbackSend,test.debug,test.remote,test.loadingImageSource,true);
    }
    test = new Concerto($("#divTestContainer"),hash,sid,null,null,null,null,null,null,null,true);
    test.run(null,[]);
    
    select.val(0);
    Concerto.toggleSessionLauncher();
}