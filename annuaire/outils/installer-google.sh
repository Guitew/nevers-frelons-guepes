#!/usr/bin/env bash
# =====================================================================
#  Vitrine Locale — accès Google sans clé pour GitHub Actions
#
#  Le plus simple : le guide Cloud Shell en un clic (voir DEPLOIEMENT.md),
#  qui charge le dépôt, fait choisir le projet et colle la commande.
#  Sinon, à lancer d'une ligne dans Cloud Shell (https://shell.cloud.google.com) :
#    bash <(curl -sS https://raw.githubusercontent.com/Guitew/nevers-frelons-guepes/main/annuaire/outils/installer-google.sh)
#
#  Ce qu'il fait, sans jamais créer de clé (interdit par la règle
#  iam.disableServiceAccountKeyCreation) :
#    1. active les API nécessaires ;
#    2. crée le compte de service « vitrine-locale » s'il n'existe pas ;
#    3. crée un pool et un fournisseur Workload Identity pour GitHub Actions,
#       restreints au dépôt Guitew/nevers-frelons-guepes ;
#    4. autorise ce dépôt à agir au nom du compte de service ;
#    5. affiche les deux valeurs à recopier dans le workflow.
#  Relançable sans risque : chaque étape vérifie l'existant.
# =====================================================================
set -euo pipefail

DEPOT="Guitew/nevers-frelons-guepes"
COMPTE="vitrine-locale"
POOL="github"
FOURNISSEUR="github"

PROJET="${1:-}"
# Le guide Cloud Shell remplace {{project-id}} par le projet choisi ; si le
# remplacement n'a pas eu lieu, on retombe sur le projet courant ou on demande.
case "$PROJET" in ""|"{{project-id}}"|"{{"*) PROJET="$(gcloud config get-value project 2>/dev/null || true)";; esac
if [ -z "$PROJET" ] || [ "$PROJET" = "(unset)" ]; then
  echo "Projets disponibles :"
  gcloud projects list --format="table(projectId,name)"
  read -r -p "ID du projet à utiliser (celui de la clé Places) : " PROJET
fi
gcloud config set project "$PROJET" >/dev/null
NUMERO=$(gcloud projects describe "$PROJET" --format='value(projectNumber)')
SA="$COMPTE@$PROJET.iam.gserviceaccount.com"
echo "Projet : $PROJET (n° $NUMERO)"

echo "1/5 Activation des API…"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  searchconsole.googleapis.com siteverification.googleapis.com

echo "2/5 Compte de service…"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$COMPTE" --display-name="Vitrine Locale (annuaire)"

echo "3/5 Pool et fournisseur Workload Identity…"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$FOURNISSEUR" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$FOURNISSEUR" \
       --location=global --workload-identity-pool="$POOL" --display-name="GitHub" \
       --issuer-uri="https://token.actions.githubusercontent.com" \
       --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
       --attribute-condition="assertion.repository == '$DEPOT'"

echo "4/5 Autorisation du dépôt GitHub à agir au nom du compte de service…"
MEMBRE="principalSet://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/$POOL/attribute.repository/$DEPOT"
if ! gcloud iam service-accounts add-iam-policy-binding "$SA" \
     --role="roles/iam.workloadIdentityUser" --member="$MEMBRE" >/dev/null; then
  cat <<MSG

  ⚠ L'autorisation a été refusée. Cause probable : la règle d'organisation
    « iam.allowedPolicyMemberDomains » (partage restreint au domaine).
    Solution : https://console.cloud.google.com/iam-admin/orgpolicies/iam-allowedPolicyMemberDomains?project=$PROJET
    → « Gérer la règle » → « Remplacer la règle du parent » → ajouter une règle
    avec la valeur personnalisée suivante, puis relancer ce script :
    principalSet://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/$POOL
MSG
  exit 1
fi

echo "5/5 Terminé."
echo
echo "=============== À copier-coller à Claude (rien de secret) ==============="
echo "GOOGLE_WORKLOAD_IDENTITY_PROVIDER=projects/$NUMERO/locations/global/workloadIdentityPools/$POOL/providers/$FOURNISSEUR"
echo "GOOGLE_SERVICE_ACCOUNT=$SA"
echo "=========================================================================="
# Le résultat est aussi gardé dans le dossier personnel de Cloud Shell, au cas
# où le terminal serait fermé avant la copie.
{
  echo "GOOGLE_WORKLOAD_IDENTITY_PROVIDER=projects/$NUMERO/locations/global/workloadIdentityPools/$POOL/providers/$FOURNISSEUR"
  echo "GOOGLE_SERVICE_ACCOUNT=$SA"
} > "$HOME/vitrine-locale-resultat.txt"
echo "(Copie enregistrée dans ~/vitrine-locale-resultat.txt : cat ~/vitrine-locale-resultat.txt)"
