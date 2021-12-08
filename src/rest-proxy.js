import axios from 'axios';

const verbs = ['get','post','put','delete'];

export class ApiRoot{
    constructor(rootPath){
        this.rootPath = rootPath;
    }
}
export class RestPath{
    constructor(parent, path){
        this._parent = parent;
        this._path = path ;
        this._stringValue = this._flatened().map(x=>encodeURIComponent(x)).join('/');        
    }
    toString(){
        return this._stringValue;
    }
    _flatened(){
        let current = this;
        const result = [];
        do{
            
            while(copy.length > 0){
                result.unshift(current._path);
            }
            current = current._parent;
        } while( current && ! (current instanceof ApiRoot));    
        return result;

    }
}


class RestProxyHandler{
    constructor(axios, path, apiSpec, apiCache){
        this.axios = axios;
        this.apiSpec = apiSpec;
        this.path = path;
        this.apiCache = apiCache || {};

    }
    get(target, property, receiver){
        if(typeof(property) === "string" && verbs.includes(property.toLowerCase().trim())){
            const verb = property;
            return (...args)=>{
                const cfg = this.apiSpec.createRequestConfig(verb, this.path, args);
                return this.axios(cfg);
            }
        }
        else{
            //we've neen passed an path-component -- append it and 
            const childPath = this.apiSpec.createChildPath(this.path, property);
            if(!this.apiCache[childPath]){
                this.apiCache[childPath] = new Proxy({}, new RestProxyHandler(this.axios, childPath, this.apiSpec, this.apiCache));
            }
            return this.apiCache[childPath];
        }   
    }
    set(){
         // no-op -- dont let consumers change it
    }
}


export const RestApi = new Proxy(function(){}, {
    construct(target, args){        
        let [apiSpec, axiosInstance] = [...args];
        if(typeof(apiSpec) === 'string'){
            apiSpec = new RestApiSpec(apiSpec, '');
        }
        if(Array.isArray(apiSpec)){
            apiSpec = new RestApiSpec(apiSpec[0], apiSpec[1]);
        }
        if(!apiSpec){
            apiSpec = new RestApiSpec(location.origin, 'rest');
        }
        if(!axiosInstance){
            axiosInstance = axios;
        }
        return new Proxy({}, new RestProxyHandler(axiosInstance, apiSpec.getRootPath(), apiSpec, {}));
    }
});

export class RestApiSpec{
    constructor(url, restPrefix, resultTransformer){
        this.rootPath = new RestPath(new ApiRoot(url), restPrefix);
        this.resultTransformer = resultTransformer || ((request)=>request.then(resp=>resp.data));
    }
    getRootPath(){
        return this.rootPath;
    }
    createRequestConfig(verb, path, args){
        //Todo: 
        const result = {
            url: path.toString(),
            method: verb,
            baseUrl: path.getRoot().toString(),
        };
        if(verb === "get" || verb === "delete"){
            if(args.length === 1){
                result.params = args[0];
            }
        }
        else {
            if(args.length === 1){
                result.data = args[0];
            }
            else{
                result.data = args;
            }
        }
        return result;
    }
    createChildPath(path, element){
        return new RestPath(path, element);
    }
}

 
