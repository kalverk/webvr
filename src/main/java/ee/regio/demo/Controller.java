package ee.regio.demo;

import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * Created by user on 20.06.2015.
 */

public class Controller {
    @RequestMapping(value = "/", method = RequestMethod.GET)
    public String index(ModelMap model) {
        return "index.html";
    }
}
