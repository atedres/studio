
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, User, Users, CalendarDays, MapPin, ClipboardList, AlertTriangle, ChevronsRight, Milestone, Trash2, Loader2 } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast"
import { Separator } from '@/components/ui/separator';


interface Anomaly {
    description: string;
    famille: string;
    criticite: "Mineure" | "Moyenne" | "Majeure" | "Critique";
    actionsCorrectives: string;
    responsable: string;
    echeance?: Timestamp;
    avancement: "En cours" | "Réalisée" | "Non réalisée";
}

interface CAADetails {
    id: string;
    date: Timestamp;
    activite: string;
    zone: string;
    poste: string;
    animateur: string;
    garant: string;
    participants: string;
    anomalies: Anomaly[];
    commentaires: string;
    status: string;
}


export default function ChasseAuxAnomaliesDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { toast } = useToast();

    const [caa, setCaa] = useState<CAADetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);


    useEffect(() => {
        if (!id) return;

        const fetchCAA = async () => {
            setLoading(true);
            const docRef = doc(db, 'chassesAuxAnomalies', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setCaa({ id: docSnap.id, ...docSnap.data() } as CAADetails);
            } else {
                console.log("No such document!");
                // Optionally, redirect to a 404 page
            }
            setLoading(false);
        };

        fetchCAA();
    }, [id]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const docRef = doc(db, 'chassesAuxAnomalies', id);
            await deleteDoc(docRef);
            toast({
                title: "Suppression réussie",
                description: "Le rapport de CAA a été supprimé.",
            });
            router.push('/dashboard/anomalies');
        } catch (error) {
            console.error("Error deleting document: ", error);
            toast({
                variant: "destructive",
                title: "Erreur de suppression",
                description: "Impossible de supprimer le rapport. Veuillez réessayer.",
            });
            setIsDeleting(false);
        }
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "Réalisée": return "default";
            case "En cours": return "outline";
            case "Non réalisée": return "destructive";
            default: return "secondary";
        }
    };

    const getCriticiteVariant = (criticite: string) => {
        switch (criticite) {
            case "Critique": return "destructive";
            case "Majeure": return "default";
            case "Moyenne": return "secondary";
            case "Mineure": return "outline";
            default: return "secondary";
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-80" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-48 col-span-1 lg:col-span-3" />
                    <Skeleton className="h-64 col-span-1 lg:col-span-3" />
                </div>
            </div>
        )
    }

    if (!caa) {
        return (
            <div className="text-center">
                <p>Le rapport de Chasse Aux Anomalies n'a pas été trouvé.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard/anomalies">Retour à la liste</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                     <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                     </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Détail de la CAA</h1>
                        <p className="text-muted-foreground">ID: {caa.id}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Button asChild>
                        <Link href={`/dashboard/anomalies/${caa.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Modifier
                        </Link>
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est irréversible. Le rapport sera définitivement supprimé de la base de données.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmer la suppression
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informations Générales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 text-sm">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Date:</strong> {format(caa.date.toDate(), 'PPP', { locale: fr })}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Zone/Unité:</strong> {caa.zone}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Activité observée:</strong> {caa.activite}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Animateur:</strong> {caa.animateur}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Garant:</strong> {caa.garant}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Milestone className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Poste de travail:</strong> {caa.poste}</div>
                    </div>
                     <div className="flex items-start gap-3 col-span-full">
                        <Users className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <strong className="font-medium">Participants:</strong>
                            <p className="whitespace-pre-wrap text-muted-foreground">{caa.participants}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Anomalies Constatées</CardTitle>
                    <CardDescription>Liste des anomalies et des plans d'action associés.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {caa.anomalies.map((anomalie, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-base mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Anomalie n°{index + 1}
                            </h4>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">Description</p>
                                    <p className="text-sm text-muted-foreground">{anomalie.description}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="font-medium">Famille de Risque</p>
                                        <p className="text-muted-foreground">{anomalie.famille}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Criticité</p>
                                        <Badge variant={getCriticiteVariant(anomalie.criticite) as any}>{anomalie.criticite || "N/A"}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Avancement</p>
                                        <Badge variant={getStatusVariant(anomalie.avancement)}>{anomalie.avancement}</Badge>
                                    </div>
                                </div>
                                <Separator/>
                                <h5 className="font-medium text-sm pt-2">Plan d'action</h5>
                                <div className="space-y-1 col-span-full">
                                    <p className="font-medium text-sm">Actions Correctives</p>
                                    <p className="text-sm text-muted-foreground">{anomalie.actionsCorrectives || "N/A"}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="font-medium">Responsable</p>
                                        <p className="text-muted-foreground">{anomalie.responsable || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Échéance</p>
                                        <p className="text-muted-foreground">{anomalie.echeance ? format(anomalie.echeance.toDate(), 'PPP', { locale: fr }) : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Commentaires & Recommandations</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{caa.commentaires || "Aucun commentaire."}</p>
                </CardContent>
            </Card>

        </div>
    );
}
