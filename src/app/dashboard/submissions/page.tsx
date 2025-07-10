
"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp, where, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Eye, Inbox, MoreHorizontal, Check, X, MessageSquare, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from 'date-fns/locale'
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { logActivity } from "@/lib/activityLogger"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type SubmissionStatus = "En attente de validation" | "À corriger" | "Validé" | "Rejeté" | "Ouverte" | "Clôturée" | "Brouillon";
type SubmissionType = "Dialogue Sécurité" | "Chasse aux Anomalies";

interface Submission {
    id: string;
    type: SubmissionType;
    createdAt: Timestamp;
    author: string;
    zone?: string;
    status: SubmissionStatus;
    rawStatus: string;
}

export default function SubmissionsPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()
    const { toast } = useToast()

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
    const [correctionComment, setCorrectionComment] = useState("");

    const fetchSubmissions = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        const canManage = ['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role);
        if (!canManage) {
            setLoading(false);
            return;
        }

        try {
            const isFullAdmin = user.role === 'admin';
            
            const dsBaseQuery = collection(db, "dialoguesSecurite");
            const caaBaseQuery = collection(db, "chassesAuxAnomalies");

            const dsQuery = isFullAdmin 
                ? query(dsBaseQuery, orderBy("createdAt", "desc")) 
                : query(dsBaseQuery, where("zone", "==", user.entity), orderBy("createdAt", "desc"));
                
            const caaQuery = isFullAdmin
                ? query(caaBaseQuery, orderBy("createdAt", "desc"))
                : query(caaBaseQuery, where("zone", "==", user.entity), orderBy("createdAt", "desc"));

            
            const [dsSnapshot, caaSnapshot] = await Promise.all([getDocs(dsQuery), getDocs(caaQuery)]);

            const allSubmissions: Submission[] = [];

            dsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'Brouillon') {
                    allSubmissions.push({
                        id: doc.id,
                        type: 'Dialogue Sécurité',
                        createdAt: data.createdAt,
                        author: data.observateur,
                        zone: data.zone,
                        status: data.status,
                        rawStatus: data.status,
                    });
                }
            });

            caaSnapshot.docs.forEach(doc => {
                const data = doc.data();
                // CAA have a simpler status system, we can map it to our unified one
                // For this page, we'll consider "Ouverte" as "En attente de validation"
                let mappedStatus: SubmissionStatus = data.status;
                if (data.status === 'Ouverte') mappedStatus = 'En attente de validation';
                else if (data.status === 'Clôturée') mappedStatus = 'Validé';

                if (data.status !== 'Brouillon') {
                    allSubmissions.push({
                        id: doc.id,
                        type: 'Chasse aux Anomalies',
                        createdAt: data.createdAt,
                        author: data.animateur,
                        zone: data.zone,
                        status: mappedStatus,
                        rawStatus: data.status
                    });
                }
            });

            allSubmissions.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

            setSubmissions(allSubmissions);

        } catch (error) {
            console.error("Error fetching submissions: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les soumissions." });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const { pending, toCorrect, validated, rejected } = useMemo(() => ({
        pending: submissions.filter(s => s.status === 'En attente de validation'),
        toCorrect: submissions.filter(s => s.status === 'À corriger'),
        validated: submissions.filter(s => s.status === 'Validé'),
        rejected: submissions.filter(s => s.status === 'Rejeté'),
    }), [submissions]);


    const handleDialogSubmit = async (action: 'reject' | 'requestCorrection') => {
        if (!user || !activeSubmission) return;
        setIsSubmitting(true);
        
        const isDS = activeSubmission.type === 'Dialogue Sécurité';
        const collectionName = isDS ? 'dialoguesSecurite' : 'chassesAuxAnomalies';
        const docRef = doc(db, collectionName, activeSubmission.id);
        
        let updateData: any = {
            validePar: user.displayName || user.email,
            dateValidation: serverTimestamp(),
        };
        let toastTitle = "";
        let actionString = "";
        let details: Record<string, any> = { docId: activeSubmission.id };

        try {
            if (action === 'reject') {
                if (!rejectionReason) {
                     toast({ variant: "destructive", title: "Erreur", description: "Le motif de rejet est obligatoire." }); setIsSubmitting(false); return;
                }
                updateData.status = "Rejeté";
                updateData.rejetMotif = rejectionReason;
                toastTitle = `${activeSubmission.type} Rejeté(e)`;
                actionString = `Rejet de ${activeSubmission.type}`;
                details.motif = rejectionReason;
            } else if (action === 'requestCorrection') {
                if (!correctionComment) {
                     toast({ variant: "destructive", title: "Erreur", description: "Un commentaire est requis." }); setIsSubmitting(false); return;
                }
                updateData.status = "À corriger";
                updateData.demandeCorrectionCommentaire = correctionComment;
                toastTitle = "Demande de Correction Envoyée";
                actionString = `Demande de correction sur ${activeSubmission.type}`;
                details.commentaire = correctionComment;
            }

            await updateDoc(docRef, updateData);
            await logActivity(user, actionString, details);

            fetchSubmissions(); // Refresh list
            toast({ title: toastTitle });
        } catch (error) {
            console.error(`Error ${action} document: `, error);
            toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue." });
        } finally {
            setIsSubmitting(false);
            setIsRejectDialogOpen(false); setRejectionReason("");
            setIsCorrectionDialogOpen(false); setCorrectionComment("");
            setActiveSubmission(null);
        }
    };

    const handleQuickValidate = async (submission: Submission) => {
        if (!user) return;
        setIsSubmitting(true);
        
        const isDS = submission.type === 'Dialogue Sécurité';
        const collectionName = isDS ? 'dialoguesSecurite' : 'chassesAuxAnomalies';
        const finalStatus = isDS ? 'Validé' : 'Clôturée';

        const docRef = doc(db, collectionName, submission.id);
        try {
            await updateDoc(docRef, { 
                status: finalStatus,
                validePar: user.displayName || user.email,
                dateValidation: serverTimestamp(),
            });
            await logActivity(user, `Validation de ${submission.type}`, { docId: submission.id });
            toast({ title: `${submission.type} validé(e)` });
            fetchSubmissions(); // Refresh list
        } catch (error) {
            console.error("Error validating document: ", error);
            toast({ variant: "destructive", title: "Erreur de validation" });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case "Validé": case "Clôturée": return "default";
            case "Brouillon": return "secondary";
            case "Rejeté": return "destructive";
            case "En attente de validation": case "À corriger": case "Ouverte": return "outline";
            default: return "secondary";
        }
    };

    const renderTable = (data: Submission[], emptyMessage: string) => (
         <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                     [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                            <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                        </TableRow>
                    ))
                ) : data.length > 0 ? data.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.type}</TableCell>
                        <TableCell>{item.author}</TableCell>
                        <TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></TableCell>
                        <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting && activeSubmission?.id === item.id}>
                                        <span className="sr-only">Ouvrir le menu</span>
                                        {isSubmitting && activeSubmission?.id === item.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <Link href={item.type === 'Dialogue Sécurité' ? `/dashboard/audits/${item.id}` : `/dashboard/anomalies/${item.id}`} passHref>
                                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> Voir</DropdownMenuItem>
                                    </Link>
                                    {item.status === 'En attente de validation' && (
                                        <>
                                            <DropdownMenuItem onClick={() => handleQuickValidate(item)}><Check className="mr-2 h-4 w-4" /> Valider</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => { setActiveSubmission(item); setIsCorrectionDialogOpen(true); }}><MessageSquare className="mr-2 h-4 w-4" /> Demander Correction</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => { setActiveSubmission(item); setIsRejectDialogOpen(true); }}><X className="mr-2 h-4 w-4" /> Rejeter</DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">{emptyMessage}</TableCell></TableRow>
                )}
            </TableBody>
        </Table>
    );

    if (user && !['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role)) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Accès non autorisé</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Vous n'avez pas les permissions nécessaires pour voir cette page.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Soumissions</h1>
                <p className="text-muted-foreground">
                    Validez, corrigez ou rejetez les soumissions de votre unité.
                </p>
            </div>
            <Card>
                <Tabs defaultValue="pending">
                    <TabsList className="grid w-full grid-cols-4 m-4">
                        <TabsTrigger value="pending">En attente ({pending.length})</TabsTrigger>
                        <TabsTrigger value="toCorrect">À corriger ({toCorrect.length})</TabsTrigger>
                        <TabsTrigger value="validated">Validées ({validated.length})</TabsTrigger>
                        <TabsTrigger value="rejected">Rejetées ({rejected.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="p-0">
                        <CardContent>{renderTable(pending, "Aucune soumission en attente.")}</CardContent>
                    </TabsContent>
                    <TabsContent value="toCorrect" className="p-0">
                         <CardContent>{renderTable(toCorrect, "Aucune soumission à corriger.")}</CardContent>
                    </TabsContent>
                    <TabsContent value="validated" className="p-0">
                         <CardContent>{renderTable(validated, "Aucune soumission validée.")}</CardContent>
                    </TabsContent>
                    <TabsContent value="rejected" className="p-0">
                        <CardContent>{renderTable(rejected, "Aucune soumission rejetée.")}</CardContent>
                    </TabsContent>
                </Tabs>
            </Card>
            
            {/* Action Dialogs */}
             <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rejeter la soumission</AlertDialogTitle>
                        <AlertDialogDescription>Veuillez fournir un motif de rejet clair. Cette action est définitive.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                       <div className="grid gap-2">
                            <Label htmlFor="rejection-reason">Motif du rejet</Label>
                            <Textarea id="rejection-reason" placeholder="Ex: Informations incomplètes..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDialogSubmit('reject')} disabled={isSubmitting || !rejectionReason}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer le rejet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Demander une Correction</DialogTitle>
                        <DialogDescription>Expliquez à l'auteur les modifications nécessaires.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                       <div className="grid gap-2">
                            <Label htmlFor="correction-comment">Commentaire</Label>
                            <Textarea id="correction-comment" placeholder="Ex: Veuillez détailler davantage l'action corrective..." value={correctionComment} onChange={(e) => setCorrectionComment(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsCorrectionDialogOpen(false)} disabled={isSubmitting}>Annuler</Button>
                        <Button onClick={() => handleDialogSubmit('requestCorrection')} disabled={isSubmitting || !correctionComment}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Envoyer la demande
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
