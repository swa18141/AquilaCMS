const mongoose = require('mongoose');
const NSErrors = require("./errors/NSErrors");
const servicesAuth = require('../services/auth');

class PostBodyCheck {
    /**
     * Constructor of PostBodyCheck
     * @param {Object} [filter={}] filter
     * @param {number} [limit=1] limit of element to get
     * @param {string[]} [populate=[]] fields to populate
     * @param {number} [skip=0] position to start the query
     * @param {Object} [sort={}] fields to order by
     * @param {Object} [structure={}] structure
     * @param {number} [page=null] page
     */
    constructor(filter = {}, limit = 1, populate = [], skip = 0, sort = {}, structure = {}, page = null) {
        this.filter    = filter;
        this.limit     = limit;
        this.populate  = populate;
        this.skip      = skip;
        this.sort      = sort;
        this.structure = structure;
        this.page      = page;
    }
}

module.exports = class QueryBuilder {
    /**
     * constructor
     * @param {mongoose.Model} model model
     * @param {string[]} [restrictedFields=[]] restrictedFields
     * @param {string[]} [defaultFields=[]] defaultFields
     * @param {number} [maxLimit=100] maxLimit
     */
    constructor(model, restrictedFields = [], defaultFields = [], maxLimit = 100) {
        this.model = model;
        // Les projections par defaut
        this.defaultFields = defaultFields;
        // operateur ne devant jamais être utilisé dans le filter
        this.restrictedOperators = ["$where"];
        // champs ne devant jamais être retourné au client sauf si admin
        this.restrictedFields = restrictedFields;
        this.maxLimit = maxLimit;
    }

    /**
     * Permet de retourner un objet PostBody valide
     *
     * @typedef {Object} PostBody
     * @property {Object} [PostBody.filter=] filter
     * @property {Object} [PostBody.structure=] structure
     * @property {Object} [PostBody.populate=] populate
     * @property {Object} [PostBody.sort=] sort
     * @property {number} [PostBody.limit=] limit
     * @property {number} [PostBody.skip=] skip
     *
     * @param {PostBody} PostBody, PostBody object
     * @param {"find" | "findOne" | "findById"} [request=find], le type de requete : (find, findOne, findById)
     */
    verifyPostBody(PostBody, request = "find") {
        if (PostBody && PostBody.PostBody) { // Fix postbody pas au bon niveau
            PostBody = PostBody.PostBody;    // P2 : Comment cela se fait-il qu'il y ait un PostBody dans un PostBody ?!
        }

        if (request === "find") {
            const postBodyChecked = new PostBodyCheck(PostBody.filter, PostBody.limit, PostBody.populate, PostBody.skip, PostBody.sort, PostBody.structure, PostBody.page);
            if (postBodyChecked.limit > this.maxLimit) postBodyChecked.limit = this.maxLimit;
            if (this.containRestrictedLabels(postBodyChecked.filter)) throw NSErrors.OperatorRestricted;
            // Permet de créer une pagination
            if (postBodyChecked.page && Number.isInteger(Number(postBodyChecked.page))) {
                postBodyChecked.page = Number(postBodyChecked.page);
                if (postBodyChecked.page < 1) postBodyChecked.page = 1;
                postBodyChecked.skip = (postBodyChecked.page - 1) * postBodyChecked.limit;
            }
            return postBodyChecked;
        } if (request === "findOne") {
            return PostBody ? new PostBodyCheck(PostBody.filter, 1, PostBody.populate, 0, {}, PostBody.structure) : new PostBodyCheck();
        } if (request === "findById") {
            return PostBody ? new PostBodyCheck({}, 1, PostBody.populate, 0, {}, PostBody.structure) : new PostBodyCheck();
        }
    }

    /**
     * Fonction qui va constuire, verifier et lancer la requete
     * @typedef {Object} PostBody
     * @property {Object} [PostBody.filter=] filter
     * @property {Object} [PostBody.structure=] structure
     * @property {Object} [PostBody.populate=] populate
     * @property {Object} [PostBody.sort=] sort
     * @property {number} [PostBody.limit=] limit
     * @property {number} [PostBody.skip=] skip
     *
     * @param {PostBody} PostBody est l'objet decrivant la requete devant être effectué par le find
     * @param {boolean} [lean=false] transform a mongoose object to object
     * @param {string} [header_authorization=null] header_authorization
     * @return {{datas: {} | mongoose.Model<this>, count: mongoose.Model<this>}} returns datas found and total of element
     */
    async find(PostBody, lean = false, header_authorization = null) {
        if (!PostBody) throw NSErrors.PostBodyUndefined;
        const postBodyChecked = this.verifyPostBody(PostBody);
        const {limit, skip, filter, populate, sort, structure} = postBodyChecked;
        // TODO P4 : FABRICE changer ce comportement => on lance les requetes une par une => lancer les deux a la fois
        const count = await this.model.countDocuments(filter);
        const addStructure = this.addToStructure(structure, sort);
        let datas;
        if (lean) {
            datas = await this.model.find(filter, addStructure).lean().sort(sort).skip(skip).limit(limit).populate(populate);
        } else {
            datas = await this.model.find(filter, addStructure).sort(sort).skip(skip).limit(limit).populate(populate);
        }
        await this.removeFromStructure(structure, datas, header_authorization);
        return {datas, count};
    }

    /**
     * Fonction qui va constuire, verifier et lancer la requete
     * @typedef {Object} PostBody
     * @property {Object} [PostBody.filter=] filter
     * @property {Object} [PostBody.structure=] structure
     * @property {Object} [PostBody.populate=] populate
     * @property {Object} [PostBody.sort=] sort
     * @property {number} [PostBody.limit=] limit
     * @property {number} [PostBody.skip=] skip
     *
     * @param {PostBody} PostBody est l'objet decrivant la requete devant être effectué par le find
     * @param {boolean} [lean=false] transform a mongoose object to object
     * @param {string} [header_authorization=null] header_authorization
     * @return {Object|mongoose.Model<this>} returns datas found and total of element
     */
    async findOne(PostBody = null, lean = false, header_authorization = null) {
        if (!PostBody) throw NSErrors.PostBodyUndefined;
        if (!PostBody.filter) throw NSErrors.PostBodyFilterUndefined;
        if (!Object.keys(PostBody.filter).length) throw NSErrors.PostBodyFilterUndefined;
        // création d'un objet PostBody avec des valeurs par défaut
        const postBodyCheck = this.verifyPostBody(PostBody, "findOne");
        const {filter, populate, structure} = postBodyCheck;
        if (this.containRestrictedLabels(filter)) throw NSErrors.OperatorRestricted;
        const addStructure = this.addToStructure(structure);
        let datas;
        if (lean) {
            datas = await this.model.findOne(filter, addStructure).lean().populate(populate);
        } else {
            datas = await this.model.findOne(filter, addStructure).populate(populate);
        }
        await this.removeFromStructure(structure, datas, header_authorization);
        return datas;
    }

    /**
     * Fonction qui va constuire, verifier et lancer la requete
     * @typedef {Object} PostBody
     * @property {Object} [PostBody.filter=] filter
     * @property {Object} [PostBody.structure=] structure
     * @property {Object} [PostBody.populate=] populate
     * @property {Object} [PostBody.sort=] sort
     * @property {number} [PostBody.limit=] limit
     * @property {number} [PostBody.skip=] skip
     *
     * @param {PostBody} PostBody est l'objet decrivant la requete devant être effectué par le find
     * @param {boolean} [lean=false] transform a mongoose object to object
     * @param {string} [header_authorization=null] header_authorization
     * @return {Object|mongoose.Model<this>} returns datas found and total of element
     */
    async findById(id, PostBody = null, header_authorization = null) {
        // création d'un objet PostBody avec des valeurs par défaut
        const postBodyCheck = this.verifyPostBody(PostBody, "findById");
        const {populate, structure} = postBodyCheck;
        if (!mongoose.Types.ObjectId.isValid(id)) throw NSErrors.InvalidObjectIdError;
        const addStructure = this.addToStructure(structure);
        const datas = await this.model.findById(id, addStructure).populate(populate);
        await this.removeFromStructure(structure, datas, header_authorization);
        return datas;
    }

    /**
     * Cette fonction ajoute les champs par défaut a l'object structure du queryBuilder
     * @param {*} structure envoyé dans le queryBuilder
     */
    addToStructure(structure, sort = null) {
        const structureAdd = [];
        // Si la structure[0] === "*" alors on renvoie tous les champs
        if ((this.defaultFields && this.defaultFields[0] === "*") || structure === '*') {
            if (sort) {
                Object.entries(sort).forEach(([key, value]) => {
                    if (typeof sort[key] === "object" && sort[key].$meta) structureAdd.push({[key]: value});
                });
                const defaultProjection = [...this.defaultFields, ...structureAdd];
                const oProjection = {};
                // On crée l'objet oProjection qui contiendra les champs a afficher
                defaultProjection.forEach((struct) =>  {
                    if (typeof struct === "object") {
                        // exemple : struct == {"score": {"$meta": "textScore"}} dans la projection
                        const key = Object.keys(struct)[0];
                        oProjection[key] = struct[key];
                    }
                });
                return oProjection;
            }
            return  {};
        }
        Object.entries(structure).forEach(([key, value]) => {
            if (this.restrictedFields.includes(key)) console.log("includes ");
            else if (value === 1) structureAdd.push(key);
            else if (typeof structure[key] === "object" && structure[key].$meta) structureAdd.push({[key]: value});
        });
        const defaultProjection = [...this.defaultFields, ...structureAdd];
        const oProjection = {};
        // On crée l'objet oProjection qui contiendra les champs a afficher
        defaultProjection.forEach((struct) =>  {
            if (typeof struct === "object") {
                // exemple : struct == {"score": {"$meta": "textScore"}} dans la projection
                const key = Object.keys(struct)[0];
                oProjection[key] = struct[key];
            } else oProjection[struct] = 1;
        });
        return oProjection;
    }

    /**
     * On supprime les champs
     * @param {*} structure
     * @param {*} datas
     * @param header_authorization
     */
    async removeFromStructure(structure, datas, header_authorization = null) {
        const isAdmin = servicesAuth.isAdmin(header_authorization);
        if (!datas || datas.length === 0 || isAdmin || structure === '*') return;
        const structureRemove = [...this.restrictedFields];
        Object.entries(structure)
            .forEach(([key, value]) => {
                if (this.restrictedFields.includes(key)) console.log("includes ");
                else if (value === 0) structureRemove.push(key);
            });
        if (datas.length) {
            for (let i = 0; i < datas.length; i++) {
                // TODO P6 : gérer dynamiquement la suppression des champs en dot notation (plusieurs niveaux)
                Object.values(structureRemove)
                    .forEach((key) => {
                        const arr = key.split('.');
                        if (arr.length > 1) {
                            if (datas[i]._doc && datas[i]._doc[arr[0]]) {
                                if (arr.length === 2) {
                                    delete datas[i]._doc[arr[0]][arr[1]];
                                } else if (arr.length === 3) {
                                    delete datas[i]._doc[arr[0]][arr[1]][arr[2]];
                                }
                            } else if (datas[i][arr[0]]) {
                                if (arr.length === 2) {
                                    delete datas[i][arr[0]][arr[1]];
                                } else if (arr.length === 3) {
                                    delete datas[i][arr[0]][arr[1]][arr[2]];
                                }
                            }
                        } else {
                            if (datas[i]._doc) {
                                delete datas[i]._doc[key];
                            } else {
                                delete datas[i][key];
                            }
                        }
                    });
            }
        } else {
            Object.values(structureRemove)
                .forEach((key) => {
                    const arr = key.split('.');
                    if (arr.length > 1) {
                        if (datas._doc && datas._doc[arr[0]]) {
                            if (arr.length === 2) {
                                delete datas._doc[arr[0]][arr[1]];
                            } else if (arr.length === 3) {
                                delete datas._doc[arr[0]][arr[1]][arr[2]];
                            }
                        } else if (datas[arr[0]]) {
                            if (arr.length === 2) {
                                delete datas[arr[0]][arr[1]];
                            } else if (arr.length === 3) {
                                delete datas[arr[0]][arr[1]][arr[2]];
                            }
                        }
                    } else {
                        if (datas._doc) {
                            delete datas._doc[key];
                        } else {
                            delete datas[key];
                        }
                    }
                });
        }
        return datas;
    }

    /**
     * Fonction permettant de verifier les champs de l'objet "oFilter"
     * @param {Object} oFilter => objet a passer dans le find, les champs seront verifiés par restrictedOperators
     */
    containRestrictedLabels(oFilter) {
        for (const field in oFilter) {
            // Si le champ est une primitive
            if (oFilter[field] !== Object(oFilter[field])) {
                if (this.restrictedOperators.includes(field)) return true;
            } else if (Array.isArray(oFilter[field])) {
                // voir ce qu'il est possible de faire en mongodb avec un array
            } else if (oFilter[field] instanceof Object) {
                if (this.containRestrictedLabels(oFilter[field], this.restrictedOperators)) {
                    return true;
                }
                // voir ce qu'il est possible de faire en mongodb avec un object
            }
        }
        return false;
    }
};
