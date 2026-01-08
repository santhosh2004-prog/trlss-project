sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";
    let oODataModel;

    return Controller.extend("com.trl.sitemanagementfe.controller.View4", {

        onInit: function () {
            oODataModel = this.getOwnerComponent().getModel();

            const oData = {
                runnerId: "",
                campaignNo: "",
                repairStatus: "",
                minorRepairStatus: "",
                shift: "",
                productionLines: [],
                isSensorEditable: true,

                // ✅ ADD materials here
                materials: [
                    {
                        material: "",
                        materialDesc: "",
                        quantity: "",
                        batch: ""
                    }
                ]
            };

            const oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "formData");
        }
        ,

        // ===== Add Row =====
        onAddMaterialRow: function () {
            const oModel = this.getView().getModel("formData");
            const aMaterials = oModel.getProperty("/materials");

            aMaterials.push({
                material: "",
                materialDesc: "",
                quantity: "",
                batch: ""
            });

            oModel.setProperty("/materials", aMaterials);
        }
        ,
        onSave: function () {
    const oView = this.getView();
    const oFormModel = oView.getModel("formData");

    const sSiteId = oView.byId("siteId").getValue().trim();

    if (!sSiteId) {
        sap.m.MessageToast.show("Please enter Site ID");
        return;
    }

    const aMaterials = oFormModel.getProperty("/materials") || [];

    if (aMaterials.length === 0) {
        sap.m.MessageToast.show("Please add at least one material");
        return;
    }

    // Build payload array based on CDS
    const aPayload = aMaterials.map(oItem => ({
        siteId: sSiteId,
        material: oItem.material || "",
        materialDescription: oItem.materialDesc || "",
        quantity: Number(oItem.quantity) || 0,
        batch: oItem.batch || ""
    }));

    const oODataModel = this.getOwnerComponent().getModel();
    const oListBinding = oODataModel.bindList("/inventory");

    aPayload.forEach(oEntry => {
        oListBinding.create(oEntry);
    });

    oODataModel.submitBatch(oListBinding.getUpdateGroupId())
        .then(() => {
            sap.m.MessageToast.show("Inventory draft saved successfully");
        })
        .catch(err => {
            sap.m.MessageBox.error(err?.message || "Save failed");
        });
}
,
onFindSitePress: function () {
    const oView = this.getView();
    const oFormModel = oView.getModel("formData");
    const oODataModel = this.getOwnerComponent().getModel();

    const siteId = oView.byId("siteId").getValue().trim();

    if (!siteId) {
        sap.m.MessageToast.show("Please enter Site ID.");
        return;
    }

    // Reset data
    oFormModel.setProperty("/siteMaster", {});
    oFormModel.setProperty("/materials", []);

    // ================= SITE MASTER =================
    const aSiteFilters = [
        new sap.ui.model.Filter("site_id", "EQ", siteId)
    ];

    const oSiteBinding = oODataModel.bindList(
        "/siteMaster",
        null,
        null,
        aSiteFilters
    );

    oSiteBinding.requestContexts().then(aContexts => {

        if (aContexts.length === 0) {
            sap.m.MessageToast.show("No site found for the given Site ID.");
            return;
        }

        const oSiteData = aContexts[0].getObject();

        oFormModel.setProperty("/siteMaster", {
            customer_name: oSiteData.customer_name || "",
            location: oSiteData.location || "",
            runner_id: oSiteData.runner_id || ""
        });

        // ================= INVENTORY (MATERIAL DETAILS) =================
        // Equivalent to:
        // GET /odata/v4/site-management/inventory?$filter=siteId eq '<siteId>'

        const aInventoryFilters = [
            new sap.ui.model.Filter("siteId", "EQ", siteId)
        ];

        const oInventoryBinding = oODataModel.bindList(
            "/inventory",
            null,
            null,
            aInventoryFilters
        );

        oInventoryBinding.requestContexts().then(aInvContexts => {

            const aMaterials = aInvContexts.map(oCtx => {
                const oInv = oCtx.getObject();
                return {
                    material: oInv.material || "",
                    materialDesc: oInv.materialDescription || "",
                    quantity: oInv.quantity || "",
                    batch: oInv.batch || ""
                };
            });

            oFormModel.setProperty("/materials", aMaterials);

            sap.m.MessageToast.show("Site and material details loaded successfully.");

        }).catch(err => {
            sap.m.MessageToast.show(
                err?.message || "Error while fetching inventory data"
            );
            oFormModel.setProperty("/materials", []);
        });

    }).catch(err => {
        sap.m.MessageToast.show(
            err?.message || "Error while fetching site data"
        );
    });
}



,
      


        // ===== Delete Row =====
        onDeleteMaterialRow: function (oEvent) {
            const oTable = this.byId("materialTable");
            const oItem = oEvent.getSource().getParent();
            const iIndex = oTable.indexOfItem(oItem);

            const oModel = this.getView().getModel("formData");
            const aMaterials = oModel.getProperty("/materials");

            aMaterials.splice(iIndex, 1);
            oModel.setProperty("/materials", aMaterials);
        }
        ,
        onSiteIdValueHelp: function () {
            const oView = this.getView();

            // Create dialog only once
            if (!this._oSiteVHDialog) {
                this._oSiteVHDialog = new sap.m.SelectDialog({
                    title: "Select Site ID",

                    liveChange: (oEvent) => {
                        this._onSiteSearch(oEvent);
                    },

                    confirm: (oEvent) => {
                        this._onSiteSelect(oEvent);
                    },

                    cancel: () => {
                        this._oSiteVHDialog.close();
                    },

                    items: {
                        path: "/sites",
                        template: new sap.m.StandardListItem({
                            title: "{site_id}",
                            description: "{customer_name} - {location}"
                        })
                    }
                });

                oView.addDependent(this._oSiteVHDialog);
            }

            // Fetch SiteMaster data


            // Bind list to SiteMaster
            const oListBinding = oODataModel.bindList("/siteMaster");

            // Request data
            oListBinding.requestContexts().then(aContexts => {

                const aSites = aContexts.map(oCtx => oCtx.getObject());

                const oModel = new sap.ui.model.json.JSONModel({
                    sites: aSites
                });

                this._oSiteVHDialog.setModel(oModel);
                this._oSiteVHDialog.open();

            }).catch(err => {

                sap.m.MessageToast.show("Failed to load Site IDs");
                console.error(err);

            });

        },
        _onSiteSearch: function (oEvent) {
            const sValue = oEvent.getParameter("value");

            const oFilter = new sap.ui.model.Filter(
                "site_id",
                sap.ui.model.FilterOperator.Contains,
                sValue
            );

            oEvent.getSource().getBinding("items").filter([oFilter]);
        },

        _onSiteSelect: function (oEvent) {
            const oItem = oEvent.getParameter("selectedItem");
            if (!oItem) return;

            const sSiteId = oItem.getTitle();

            const oInput = this.byId("siteId");

            // Set value
            oInput.setValue(sSiteId);

            this._oSiteVHDialog.close();
        },

        onNavToHome: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("Home");
        }


    });
});
