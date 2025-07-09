
"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { FilePlus2, Eye, TrendingUp, AlertOctagon, UserCheck, ListChecks, MoreHorizontal, Check, X, MessageSquare, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { startOfMonth, subMonths } from 'date-fns'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { logActivity } from "@/lib/activityLogger"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


interface Anomaly {
    type: "AD" | "IS" | "SD";
    description: string;
}

interface Dialogue {
  id: string;
  date: {
      seconds: number;
      nanoseconds: number;
  };
  observateur: string;
  zone: string;
  anomalies: Anomaly[];
  status: string;
}

interface DialogueStats {
    dialoguesCeMois: number;
    totalAnomalies: number;
    topObservateur: { name: string; count: number };
    anomaliesParType: { name: string; value: number; fill: string }[];
}

const ANOMALY_TYPE_COLORS: { [key: string]: string } = {
    "Acte Dangereux": "hsl(var(--chart-1))",
    "Situation Dangereuse": "hsl(var(--chart-2))",
    "Système Défaillant": "hsl(var(--chart-3))",
    "Autre": "hsl(var(--chart-4))",
};
const ANOMALY_TYPE_MAP: { [key: string]: string } = {
    "AD": "Acte Dangereux",
    "IS": "Situation Dangereuse",
    "SD": "Système Défaillant",
};

const demoDialogues: Dialogue[] = [
    { id: 'demo-ds-1', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, observateur: 'A. Saidi', zone: 'Laminoir', anomalies: [{ type: 'AD', description: 'Non-port du casque' }], status: 'Validé' },
    { id: 'demo-ds-2', date: { seconds: Timestamp.fromDate(subMonths(new Date(), 1)).seconds, nanoseconds: 0 }, observateur: 'M. Tazi', zone: 'Aciérie', anomalies: [], status: 'Clôturée' },
    { id: 'demo-ds-3', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, observateur: 'L. Bennani', zone: 'Logistique', anomalies: [{ type: 'IS', description: 'Zone de stockage encombrée' }], status: 'En attente de validation' },
    { id: 'demo-ds-4', date: { seconds: Timestamp.now().seconds, nanoseconds: 0 }, observateur: 'S. Kettani', zone: 'Maintenance', anomalies: [{ type: 'SD', description: 'Garde de protection manquante' }], status: 'À corriger' },
];

const demoStats: DialogueStats = {
    dialoguesCeMois: 12,
    totalAnomalies: 28,
    topObservateur: { name: 'A. Saidi', count: 25 },
    anomaliesParType: [
        { name: 'Acte Dangereux', value: 15, fill: ANOMALY_TYPE_COLORS['Acte Dangereux'] },
        { name: 'Situation Dangereuse', value: 10, fill: ANOMALY_TYPE_COLORS['Situation Dangereuse'] },
        { name: 'Système Défaillant', value: 3, fill: ANOMALY_TYPE_COLORS['Système Défaillant'] },
    ]
};


export default function DialoguesSecuritePage() {
  const [allDialogues, setAllDialogues] = useState<Dialogue[]>([])
  const [stats, setStats] = useState<DialogueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, isDemoMode } = useAuth();
  const { toast } = useToast();
  
  const canManage = user && ['niveau3', 'niveau4', 'niveau5', 'admin'].includes(user.role);

  // State for handling actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDialogue, setActiveDialogue] = useState<Dialogue | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const [correctionComment, setCorrectionComment] = useState("");


  const { pendingDialogues, historicalDialogues } = useMemo(() => {
    const pending = allDialogues.filter(d => d.status === 'En attente de validation');
    const historical = allDialogues.filter(d => d.status !== 'En attente de validation');
    return { pendingDialogues: pending, historicalDialogues: historical };
  }, [allDialogues]);

  useEffect(() => {
    if (isDemoMode) {
        setAllDialogues(demoDialogues);
        setStats(demoStats);
        setLoading(false);
        return;
    }

    const calculateStats = (data: Dialogue[]) => {
        const now = new Date();
        const debutMois = startOfMonth(now);

        const dialoguesCeMois = data.filter(d => new Date(d.date.seconds * 1000) >= debutMois).length;
        
        const allAnomalies = data.flatMap(d => d.anomalies);

        const observateurCounts = data.reduce((acc, dialogue) => {
            acc[dialogue.observateur] = (acc[dialogue.observateur] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topObservateur = Object.entries(observateurCounts).reduce((top, [name, count]) => {
            return count > top.count ? { name, count } : top;
        }, { name: 'N/A', count: 0 });

        const anomaliesParTypeMap = new Map<string, number>();
        allAnomalies.forEach(anomaly => {
            const typeName = ANOMALY_TYPE_MAP[anomaly.type] || "Autre";
            anomaliesParTypeMap.set(typeName, (anomaliesParTypeMap.get(typeName) || 0) + 1);
        });

        const anomaliesParType = Array.from(anomaliesParTypeMap.entries()).map(([name, value]) => ({
          name,
          value,
          fill: ANOMALY_TYPE_COLORS[name] || "hsl(var(--chart-5))",
        }));


        setStats({
            dialoguesCeMois,
            totalAnomalies: allAnomalies.length,
            topObservateur,
            anomaliesParType,
        });
    }

    const fetchDialogues = async () => {
        if (!user) return;
        setLoading(true)
        try {
            let dialoguesQuery;
            const baseQuery = collection(db, "dialoguesSecurite");

            switch (user.role) {
                case 'niveau1':
                case 'niveau2':
                    dialoguesQuery = query(baseQuery, where("createdBy", "==", user.uid), orderBy("date", "desc"));
                    break;
                case 'niveau3':
                case 'niveau4':
                case 'niveau5':
                    dialoguesQuery = query(baseQuery, where("zone", "==", user.entity), orderBy("date", "desc"));
                    break;
                case 'admin':
                    dialoguesQuery = query(baseQuery, orderBy("date", "desc"));
                    break;
                default:
                    // Return no results if role is not recognized
                    dialoguesQuery = query(baseQuery, where("createdBy", "==", "no-one"));
                    break;
            }

            const querySnapshot = await getDocs(dialoguesQuery);
            const dialoguesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Dialogue[];
            setAllDialogues(dialoguesData);
            calculateStats(dialoguesData);
        } catch (error) {
            console.error("Error fetching dialogues: ", error);
        } finally {
            setLoading(false);
        }
    };

    fetchDialogues();
  }, [user, isDemoMode]);

  const handleValidateClick = async (dialogue: Dialogue) => {
    if (isSubmitting || isDemoMode) return;
    setActiveDialogue(dialogue);
    setIsSubmitting(true);
    const docRef = doc(db, "dialoguesSecurite", dialogue.id);
    try {
        await updateDoc(docRef, {
            status: "Validé",
            validePar: user!.displayName || user!.email,
            dateValidation: serverTimestamp(),
        });
        await logActivity(user, "Validation du Dialogue Sécurité", { docId: dialogue.id });
        setAllDialogues(prev => prev.filter(d => d.id !== dialogue.id));
        toast({ title: "Dialogue Validé", description: "Le dialogue de sécurité a été approuvé." });
    } catch (error) {
        console.error("Error validating document: ", error);
        toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue." });
    } finally {
        setIsSubmitting(false);
        setActiveDialogue(null);
    }
  };

  const handleCorrectionClick = (dialogue: Dialogue) => {
      if (isDemoMode) return;
      setActiveDialogue(dialogue);
      setIsCorrectionDialogOpen(true);
  };
  
  const handleRejectClick = (dialogue: Dialogue) => {
      if (isDemoMode) return;
      setActiveDialogue(dialogue);
      setIsRejectDialogOpen(true);
  };

  const handleDialogSubmit = async (action: 'reject' | 'requestCorrection') => {
      if (!user || !activeDialogue || isDemoMode) return;
      setIsSubmitting(true);
      const docRef = doc(db, "dialoguesSecurite", activeDialogue.id);
      
      let updateData: any = {
          validePar: user.displayName || user.email,
          dateValidation: serverTimestamp(),
      };
      let toastTitle = "";
      let toastDescription = "";
      let actionString = "";
      let details: Record<string, any> = { docId: activeDialogue.id };

      try {
          if (action === 'reject') {
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
          } else if (action === 'requestCorrection') {
              if (!correctionComment) {
                   toast({ variant: "destructive", title: "Erreur", description: "Un commentaire est requis." });
                   setIsSubmitting(false);
                   return;
              }
              updateData.status = "À corriger";
              updateData.demandeCorrectionCommentaire = correctionComment;
              toastTitle = "Demande de Correction Envoyée";
              toastDescription = "L'auteur a été notifié.";
              actionString = "Demande de correction sur le Dialogue Sécurité";
              details.commentaire = correctionComment;
          }

          await updateDoc(docRef, updateData);
          if (actionString) {
              await logActivity(user, actionString, details);
          }

          setAllDialogues(prev => prev.filter(d => d.id !== activeDialogue.id));
          toast({ title: toastTitle, description: toastDescription });
      } catch (error) {
          console.error(`Error ${action} document: `, error);
          toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue." });
      } finally {
          setIsSubmitting(false);
          setIsRejectDialogOpen(false);
          setRejectionReason("");
          setIsCorrectionDialogOpen(false);
          setCorrectionComment("");
          setActiveDialogue(null);
      }
  };


  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Validé":
      case "Clôturée":
        return "default"
      case "Brouillon":
        return "secondary"
      case "En attente de validation":
      case "Rejeté":
        return "destructive"
      case "Actions correctives ouvertes":
      case "À corriger":
        return "outline"
      default:
        return "secondary"
    }
  }

  const renderSkeleton = (rows = 5) => (
    [...Array(rows)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
        <TableCell><Skeleton className="h-10 w-24" /></TableCell>
      </TableRow>
    ))
  )
  
  const getLinkHref = (dialogue: Dialogue) => {
    if (isDemoMode) return "#";
    return dialogue.status === 'Brouillon' || dialogue.status === 'À corriger' ? `/dashboard/audits/${dialogue.id}/edit` : `/dashboard/audits/${dialogue.id}`;
  }


  const renderTable = (data: Dialogue[], emptyMessage: string, isPendingTab = false) => (
    <Table>
        <TableHeader>
        <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Observateur</TableHead>
            <TableHead>Zone / Unité</TableHead>
            <TableHead>Anomalies Signalées</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
        </TableRow>
        </TableHeader>
        <TableBody>
        {loading ? renderSkeleton() : data.length > 0 ? data.map((dialogue) => (
            <TableRow key={dialogue.id}>
            <TableCell>{new Date(dialogue.date.seconds * 1000).toLocaleDateString('fr-FR')}</TableCell>
            <TableCell>{dialogue.observateur}</TableCell>
            <TableCell>{dialogue.zone}</TableCell>
            <TableCell className="max-w-[300px]">
                {dialogue.anomalies.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                    {dialogue.anomalies.map((anomalie, index) => (
                        isPendingTab ? (
                            <li key={index} className="list-none">
                                <UiTooltip>
                                    <TooltipTrigger asChild>
                                        <span className="font-semibold cursor-help underline decoration-dashed">
                                            {ANOMALY_TYPE_MAP[anomalie.type] || "Anomalie"}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-[300px] p-2">{anomalie.description}</p>
                                    </TooltipContent>
                                </UiTooltip>
                            </li>
                        ) : (
                             <li key={index} className="list-inside list-disc truncate" title={anomalie.description}>{anomalie.description}</li>
                        )
                    ))}
                    </ul>
                ) : (
                    <span className="text-xs text-muted-foreground">Aucune</span>
                )}
            </TableCell>
            <TableCell>
                <Badge variant={getStatusVariant(dialogue.status) as any}>{dialogue.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
                {dialogue.status === 'En attente de validation' && canManage ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={(isSubmitting && activeDialogue?.id === dialogue.id) || isDemoMode}>
                                <span className="sr-only">Ouvrir le menu</span>
                                {isSubmitting && activeDialogue?.id === dialogue.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions Rapides</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleValidateClick(dialogue)}>
                                <Check className="mr-2 h-4 w-4" /> Valider
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCorrectionClick(dialogue)}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Demander Correction
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleRejectClick(dialogue)}>
                                <X className="mr-2 h-4 w-4" /> Rejeter
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <Link href={`/dashboard/audits/${dialogue.id}`} passHref>
                                <DropdownMenuItem>
                                    <Eye className="mr-2 h-4 w-4" /> Voir les détails
                                </DropdownMenuItem>
                            </Link>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Button asChild variant="outline" size="sm" disabled={isDemoMode}>
                        <Link href={getLinkHref(dialogue)}>
                            <Eye className="mr-2 h-4 w-4" /> {dialogue.status === 'Brouillon' || dialogue.status === 'À corriger' ? 'Modifier' : 'Voir'}
                        </Link>
                    </Button>
                )}
            </TableCell>
            </TableRow>
        )) : (
             <TableRow><TableCell colSpan={6} className="h-24 text-center">{emptyMessage}</TableCell></TableRow>
        )}
        </TableBody>
    </Table>
  );

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dialogue Sécurité / حوار السلامة</h1>
        <p className="text-muted-foreground">
          Suivi des dialogues sécurité réalisés sur le terrain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dialogues Réalisés (Mois)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-7 w-12" /> : <div className="text-2xl font-bold">{stats?.dialoguesCeMois}</div>}
             <p className="text-xs text-muted-foreground">Depuis le début du mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Signalées (Total)</CardTitle>
             <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.totalAnomalies}</div>}
            <p className="text-xs text-muted-foreground">Dans tous les dialogues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Observateur</CardTitle>
             <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-bold">{stats?.topObservateur.name}</div>}
            {loading ? <Skeleton className="h-4 w-24 mt-1" /> : <p className="text-xs text-muted-foreground">Avec {stats?.topObservateur.count} dialogues</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-full lg:col-span-4">
            <Tabs defaultValue={canManage && pendingDialogues.length > 0 ? "pending" : "history"}>
                <TabsList className="grid w-full grid-cols-2">
                    {canManage && (
                        <TabsTrigger value="pending">
                            À Valider
                            {pendingDialogues.length > 0 && 
                                <Badge variant="destructive" className="ml-2">{pendingDialogues.length}</Badge>
                            }
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="history" className={!canManage ? "col-span-2" : ""}>Historique</TabsTrigger>
                </TabsList>
                {canManage && (
                    <TabsContent value="pending">
                        <Card>
                             <CardHeader>
                                <CardTitle>Dialogues en attente de validation</CardTitle>
                                <CardDescription>Ces dialogues doivent être revus et validés.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTable(pendingDialogues, "Aucun dialogue en attente de validation.", true)}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historique des Dialogues Sécurité</CardTitle>
                            <CardDescription>Liste de tous les dialogues réalisés, en brouillon ou en cours.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {renderTable(historicalDialogues, "Aucun dialogue dans l'historique.")}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
        <Card className="col-span-full lg:col-span-3 min-w-0">
            <CardHeader>
                <CardTitle>Anomalies par Type</CardTitle>
                <CardDescription>Répartition des anomalies signalées dans les DS.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
                {loading || !stats ? <Skeleton className="w-full h-full" /> :
                    <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                                data={stats.anomaliesParType}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label
                            >
                                {stats.anomaliesParType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                }
            </CardContent>
        </Card>
      </div>

       <div className="fixed bottom-8 right-8">
            <Button asChild size="lg" className="rounded-full h-16 w-16 shadow-lg bg-accent hover:bg-accent/90" disabled={isDemoMode}>
                <Link href={isDemoMode ? "#" : "/dashboard/audits/new"}>
                    <FilePlus2 className="h-8 w-8" />
                    <span className="sr-only">Ajouter un DS</span>
                </Link>
            </Button>
        </div>

        {/* Action Dialogs */}
        <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
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
                        <Textarea id="correction-comment" placeholder="Ex: Veuillez détailler davantage l'action corrective pour l'anomalie n°2." value={correctionComment} onChange={(e) => setCorrectionComment(e.target.value)} />
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
    </TooltipProvider>
  )
}

    