// block IE (versions before 9.0)
{
    var userAgent = navigator.userAgent.toLowerCase();
    var browser = {
        version: (userAgent.match(/(?:firefox|opera|safari|chrome|msie)[\/: ]([\d.]+)/))[1],
        safari: /version.+safari/.test(userAgent),
        chrome: /chrome/.test(userAgent),
        firefox: /firefox/.test(userAgent),
        ie: /msie/.test(userAgent),
        opera: /opera/.test(userAgent)
    }
    if (browser.ie && browser.version < 9) {
        alert("Sorry, but this site appears to be too cool for your web browser(>_<)\nPlease use one of these recommended browsers instead:\n\nGoogle Chrome\nApple Safari\nMozilla Firefox\nMicrosoft Internet Explorer 9.0 or later");
        window.location = "http://www.google.com/chrome";
    }
}

// add Coderwall badges
(function(){
    var appendCoderwallBadge = function(){
        var coderwallJSONurl ="http://www.coderwall.com/springlie.json?callback=?"
          , size = 32
          ;

        $.getJSON(coderwallJSONurl, function(data) {
            $.each(data.data.badges, function(i, item){
                var a = $("<a>")
                    .attr("href", "http://www.coderwall.com/springlie/")
                    .attr("target", "_blank")
                    ;

                $("<img>").attr("src", item.badge)
                    .attr("float", "left")
                    .attr("title", item.name + ": " + item.description)
                    .attr("alt", item.name)
                    .attr("height", size)
                    .attr("width", size)
                    .hover(
                        function(){ $(this).css("opacity", "0.6"); }
                      , function(){ $(this).css("opacity", "1.0"); }
                    )
                    .appendTo(a)
                    ;
                $("#coderwall").append(a);
            });
        });
    };

    $(function(){
       appendCoderwallBadge();
    });

}());
