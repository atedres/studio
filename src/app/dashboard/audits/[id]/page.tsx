
"use client"

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, User, CalendarDays, MapPin, ClipboardList, AlertTriangle, ThumbsUp, Users as UsersIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

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

export default function DialogueSecuriteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [ds, setDs] = useState<DSDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchDS = async () => {
            setLoading(true);
            const docRef = doc(db, 'dialoguesSecurite', id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setDs({ id: docSnap.id, ...docSnap.data() } as DSDetails);
            } else {
                console.log("No such document!");
            }
            setLoading(false);
        };

        fetchDS();
    }, [id]);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "Réalisée": return "default";
            case "En cours": return "outline";
            case "Non réalisée": return "destructive";
            default: return "secondary";
        }
    };

    const getAnomalieTypeLabel = (type: string) => {
        switch (type) {
            case "AD": return "Acte Dangereux";
            case "IS": return "Situation Dangereuse";
            case "SD": return "Système Défaillant";
            default: return type;
        }
    }

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
                    <Skeleton className="h-56 col-span-1 lg:col-span-3" />
                    <Skeleton className="h-48 col-span-1 lg:col-span-2" />
                    <Skeleton className="h-48 col-span-1" />
                </div>
            </div>
        )
    }

    if (!ds) {
        return (
             <div className="text-center">
                <p>Le rapport de Dialogue Sécurité n'a pas été trouvé.</p>
                <Button asChild className="mt-4">
                    <Link href="/dashboard/audits">Retour à la liste</Link>
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
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Détail du Dialogue Sécurité</h1>
                        <p className="text-muted-foreground">ID: {ds.id}</p>
                    </div>
                </div>
                 <Button>
                    <Edit className="mr-2 h-4 w-4" /> Modifier
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informations Générales</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 text-sm">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Date:</strong> {format(ds.date.toDate(), 'PPP', { locale: fr })}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Observateur:</strong> {ds.observateur}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Zone/Unité:</strong> {ds.zone}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Activité observée:</strong> {ds.activite}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Poste de travail:</strong> {ds.poste}</div>
                    </div>
                     <div className="flex items-center gap-3">
                        <UsersIcon className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Personnes observées:</strong> {ds.nombrePersonnes}</div>
                    </div>
                    <div className="flex items-center gap-3 col-span-full">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div><strong className="font-medium">Identification:</strong> {ds.identification}</div>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ThumbsUp className="text-green-500"/> Comportements Positifs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
                            {ds.comportementsPositifs.map((comp, index) => <li key={index}>{comp.value}</li>)}
                        </ul>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Commentaires & Recommandations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{ds.commentaires || "Aucun commentaire."}</p>
                    </CardContent>
                </Card>
            </div>


            <Card>
                <CardHeader>
                    <CardTitle>Anomalies Constatées</CardTitle>
                    <CardDescription>Liste des écarts et des plans d'action associés.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {ds.anomalies.length > 0 ? ds.anomalies.map((anomalie, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-base mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Anomalie n°{index + 1} : {getAnomalieTypeLabel(anomalie.type)}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div className="space-y-1 col-span-full">
                                    <p className="font-medium">Description</p>
                                    <p className="text-muted-foreground">{anomalie.description}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">Famille de Risque</p>
                                    <p className="text-muted-foreground">{anomalie.familleRisque}</p>
                                </div>
                                 <div className="space-y-1">
                                    <p className="font-medium">Actions Immédiates</p>
                                    <p className="text-muted-foreground">{anomalie.actionsImmediates || "N/A"}</p>
                                </div>
                                <hr className="md:col-span-2 my-2"/>
                                 <div className="space-y-1">
                                    <p className="font-medium">Responsable</p>
                                    <p className="text-muted-foreground">{anomalie.responsable || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">Garant</p>
                                    <p className="text-muted-foreground">{anomalie.garant || "N/A"}</p>
                                </div>
                                 <div className="space-y-1">
                                    <p className="font-medium">Échéance</p>
                                    <p className="text-muted-foreground">{anomalie.echeance ? format(anomalie.echeance.toDate(), 'PPP', { locale: fr }) : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">Statut</p>
                                    <Badge variant={getStatusVariant(anomalie.statut)}>{anomalie.statut}</Badge>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucune anomalie constatée pour ce dialogue.</p>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
