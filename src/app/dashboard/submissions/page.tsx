"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
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
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore"
import { Eye, Inbox } from "lucide-react"
import { format } from "date-fns"
import { fr } from 'date-fns/locale'

interface FormSubmission {
    id: string;
    templateTitle: string;
    userEmail: string;
    submittedAt: Timestamp;
}

export default function SubmissionsPage() {
    const [submissions, setSubmissions] = useState<FormSubmission[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchSubmissions = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "formSubmissions"), orderBy("submittedAt", "desc"));
                const querySnapshot = await getDocs(q);
                const submissionsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as FormSubmission[];
                setSubmissions(submissionsData);
            } catch (error) {
                console.error("Error fetching form submissions: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissions();
    }, []);

    const renderSkeleton = () => (
        [...Array(4)].map((_, i) => (
            <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-10 w-10" /></TableCell>
            </TableRow>
        ))
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Soumissions de Formulaires</h1>
                <p className="text-muted-foreground">
                    Consultez tous les formulaires remplis à partir des modèles de la bibliothèque.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historique des Soumissions</CardTitle>
                    <CardDescription>Liste de tous les formulaires personnalisés qui ont été soumis.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Titre du Formulaire</TableHead>
                                <TableHead>Soumis par</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? renderSkeleton() : submissions.length > 0 ? submissions.map((submission) => (
                                <TableRow key={submission.id}>
                                    <TableCell className="font-medium">{submission.templateTitle}</TableCell>
                                    <TableCell>{submission.userEmail}</TableCell>
                                    <TableCell>
                                        {submission.submittedAt ? format(submission.submittedAt.toDate(), 'PPP p', { locale: fr }) : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="icon">
                                            <Link href={`/dashboard/submissions/${submission.id}`}>
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">Voir</span>
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Inbox className="h-8 w-8" />
                                            <span>Aucune soumission de formulaire pour le moment.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
