
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, User, CalendarDays, MapPin, ClipboardList, AlertTriangle, ThumbsUp, Users as UsersIcon, Check, X, MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast"
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/lib/activityLogger';

// Interfaces should match the ones in [id]/page.tsx for consistency
interface Anomaly {
    type: "AD" | "IS" | "SD";
    description: string;
    familleRisque: string;
    actionsImmediates: string;
    responsable: string;
    garant: string;
    echeance?: Timestamp;
    statut: "En cours" | "Réalisée" | "Non réalisée";
}

interface DSDetails {
    id: string;
    date: Timestamp;
    observateur: string;
    activite: string;
    zone: string;
    poste: string;
    nombrePersonnes: number;
    identification: string;
    comportementsPositifs: { value: string }[];
    anomalies: Anomaly[];
    commentaires: string;
    status: string;
}

export default function ValidateDialogueSecuritePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { toast } = useToast();
    const { user } = useAuth();

    const [ds, setDs] = useState<DSDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
    const [correctionComment, setCorrectionComment] = useState("");

    const canManage = user && ['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role);

    useEffect(() => {
        if (!id) return;
        if (!canManage) {
            router.push(`/dashboard/audits/${id}`);
            return;
        }

        const fetchDS = async () => {
            setLoading(true);
            const docRef = doc(db, 'dialoguesSecurite', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().status === 'En attente de validation') {
                setDs({ id: docSnap.id, ...docSnap.data() } as DSDetails);
            } else {
                console.log("Document not found or not pending validation.");
                toast({ variant: "destructive", title: "Invalide", description: "Ce dialogue n'est pas en attente de validation."});
                router.push('/dashboard/audits');
            }
            setLoading(false);
        };

        fetchDS();
    }, [id, canManage, router, toast]);

    const handleAction = async (action: 'validate' | 'reject' | 'requestCorrection') => {
        if (!user) return;
        setIsSubmitting(true);
        const docRef = doc(db, "dialoguesSecurite", id);
        
        let updateData: any = {
            validePar: user.displayName || user.email,
            dateValidation: serverTimestamp(),
        };
        let toastTitle = "";
        let toastDescription = "";
        let actionString = "";
        let details: Record<string, any> = { docId: id };

        try {
            switch(action) {
                case 'validate':
                    updateData.status = "Validé";
                    toastTitle = "Dialogue Validé";
                    toastDescription = "Le dialogue de sécurité a été approuvé avec succès.";
                    actionString = "Validation du Dialogue Sécurité";
                    break;
                case 'reject':
                    if (!rejectionReason) {
                         toast({ variant: "destructive", title: "Erreur", description: "Le motif de rejet est obligatoire." });
                         setIsSubmitting(false);
                         return;
                    }
                    updateData.status = "Rejeté";
                    updateData.rejetMotif = rejectionReason;
                    toastTitle = "Dialogue Rejeté";
                    toastDescription = "Le dialogue de sécurité a été rejeté.";
                    actionString = "Rejet du Dialogue Sécurité";
                    details.motif = rejectionReason;
                    break;
                case 'requestCorrection':
                    if (!correctionComment) {
                         toast({ variant: "destructive", title: "Erreur", description: "Un commentaire est requis pour la demande de correction." });
                         setIsSubmitting(false);
                         return;
                    }
                    updateData.status = "À corriger";
                    updateData.demandeCorrectionCommentaire = correctionComment;
                    toastTitle = "Demande de Correction Envoyée";
                    toastDescription = "L'auteur a été notifié pour corriger sa soumission.";
                    actionString = "Demande de correction sur le Dialogue Sécurité";
                    details.commentaire = correctionComment;
                    break;
            }

            await updateDoc(docRef, updateData);
            if (actionString) {
                await logActivity(user, actionString, details);
            }

            toast({ title: toastTitle, description: toastDescription });
            router.push('/dashboard/audits');
        } catch (error) {
            console.error(`Error ${action} document: `, error);
            toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue. Veuillez réessayer." });
        } finally {
            setIsSubmitting(false);
            setIsRejectDialogOpen(false);
            setIsCorrectionDialogOpen(false);
        }
    }


    const getStatusVariant = (status: string) => "destructive"; // Always show destructive on this page
    const getAnomalieTypeLabel = (type: string) => ({ "AD": "Acte Dangereux", "IS": "Situation Dangereuse", "SD": "Système Défaillant" }[type] || type);

    if (loading) {
        return <div className="space-y-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
    }

    if (!ds) {
        return <div className="text-center"><p>Dialogue non trouvé ou déjà traité.</p></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                     <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard/audits"><ArrowLeft className="h-4 w-4" /></Link>
                     </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Valider le Dialogue Sécurité</h1>
                        <p className="text-muted-foreground">Vérifiez les informations et prenez une décision.</p>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <Card>
                <CardHeader><CardTitle>Actions de Validation</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button onClick={() => handleAction('validate')} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Valider et Clôturer
                    </Button>

                    <AlertDialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
                        <AlertDialogTrigger asChild>
                             <Button variant="outline" disabled={isSubmitting}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Demander une Correction
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Demander une Correction</AlertDialogTitle>
                                <AlertDialogDescription>Expliquez à l'auteur les modifications nécessaires.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid gap-4 py-4">
                               <div className="grid gap-2">
                                    <Label htmlFor="correction-comment">Commentaire</Label>
                                    <Textarea id="correction-comment" placeholder="Ex: Veuillez détailler davantage l'action corrective pour l'anomalie n°2." value={correctionComment} onChange={(e) => setCorrectionComment(e.target.value)} />
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleAction('requestCorrection')} disabled={isSubmitting || !correctionComment}>
                                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuer
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" disabled={isSubmitting}>
                                <X className="mr-2 h-4 w-4" /> Rejeter
                            </Button>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Rejeter le Dialogue</AlertDialogTitle>
                                <AlertDialogDescription>Veuillez fournir un motif de rejet clair. Cette action est définitive.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid gap-4 py-4">
                               <div className="grid gap-2">
                                    <Label htmlFor="rejection-reason">Motif du rejet</Label>
                                    <Textarea id="rejection-reason" placeholder="Ex: Ce dialogue est un doublon..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleAction('reject')} disabled={isSubmitting || !rejectionReason}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer le rejet
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="secondary" asChild>
                        <Link href={`/dashboard/audits/${id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Modifier Avant Validation
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Display DS Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Informations Générales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 text-sm">
                     <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Date:</strong> {format(ds.date.toDate(), 'PPP', { locale: fr })}</div></div>
                     <div className="flex items-center gap-3"><User className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Observateur:</strong> {ds.observateur}</div></div>
                    <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Zone/Unité:</strong> {ds.zone}</div></div>
                    <div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Activité observée:</strong> {ds.activite}</div></div>
                    <div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Poste de travail:</strong> {ds.poste}</div></div>
                    <div className="flex items-center gap-3"><UsersIcon className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Personnes observées:</strong> {ds.nombrePersonnes}</div></div>
                    <div className="flex items-center gap-3 col-span-full"><User className="h-5 w-5 text-muted-foreground" /><div><strong className="font-medium">Identification:</strong> {ds.identification}</div></div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2"><ThumbsUp className="text-green-500"/> Comportements Positifs</CardTitle></CardHeader><CardContent><ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">{ds.comportementsPositifs.map((comp, index) => <li key={index}>{comp.value}</li>)}</ul></CardContent></Card>
                <Card className="lg:col-span-2"><CardHeader><CardTitle>Commentaires & Recommandations</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{ds.commentaires || "Aucun commentaire."}</p></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Anomalies Constatées</CardTitle><CardDescription>Liste des écarts et des plans d'action associés.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    {ds.anomalies.length > 0 ? ds.anomalies.map((anomalie, index) => (
                        <div key={index} className="p-4 border rounded-lg"><h4 className="font-semibold text-base mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Anomalie n°{index + 1} : {getAnomalieTypeLabel(anomalie.type)}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm"><div className="space-y-1 col-span-full"><p className="font-medium">Description</p><p className="text-muted-foreground">{anomalie.description}</p></div><div className="space-y-1"><p className="font-medium">Famille de Risque</p><p className="text-muted-foreground">{anomalie.familleRisque}</p></div><div className="space-y-1"><p className="font-medium">Actions Immédiates</p><p className="text-muted-foreground">{anomalie.actionsImmediates || "N/A"}</p></div><hr className="md:col-span-2 my-2"/><div className="space-y-1"><p className="font-medium">Responsable</p><p className="text-muted-foreground">{anomalie.responsable || "N/A"}</p></div><div className="space-y-1"><p className="font-medium">Garant</p><p className="text-muted-foreground">{anomalie.garant || "N/A"}</p></div><div className="space-y-1"><p className="font-medium">Échéance</p><p className="text-muted-foreground">{anomalie.echeance ? format(anomalie.echeance.toDate(), 'PPP', { locale: fr }) : 'N/A'}</p></div><div className="space-y-1"><p className="font-medium">Statut</p><Badge variant={anomalie.statut === 'Réalisée' ? 'default' : 'outline'}>{anomalie.statut}</Badge></div></div></div>
                    )) : (<p className="text-sm text-muted-foreground text-center py-4">Aucune anomalie constatée pour ce dialogue.</p>)}
                </CardContent>
            </Card>
        </div>
    );
}
